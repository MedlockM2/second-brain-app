"""Daily refresh of the EUR/USD rate the beta budget converts with (task-559).

Rule 15 of the owner decision in ``docs/research/task-547-beta-budget-control/README.md``:
the rate is the ECB reference rate of the day, kept up to date automatically, and
when the update fails the last rate stays in place. It only converts dollar tariffs
into the euro budget, so nothing is ever refused because of it
(``beta_budget.fx_rate`` falls back to the seeded rate on an unusable value).

One EventBridge schedule calls :func:`handle_event` on working days after the ECB
publication (around 16:00 CET). It reads the public daily file — no key — takes
the USD rate and its publication date, and writes the ``eur_usd_rate`` row of
``pricing_config`` in the shape ``DEFAULT_PRICING_CONFIG`` seeds it with:
``{"usd_per_eur", "published_on", "source"}``.

**The write is conditional on the date moving forward**: the row carries its
``published_on`` as a top-level attribute too, and the update only applies when
the stored date is older. Running twice the same day, on a weekend or a holiday
(the file still holds the last working day), or after a late redelivery changes
nothing. A file that cannot be fetched or read writes nothing either: the failure
is logged and the function returns normally, so the scheduler does not retry into
the same answer.

Deliberately self-contained — ``boto3`` and ``httpx``, no import of the
application's DynamoDB layer — so its Lambda needs one table name and an IAM role
scoped to this single row (``lambda_ecb_rate.tf``).
"""

from __future__ import annotations

import json
import logging
import os
import re
import xml.etree.ElementTree as ElementTree
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional, Tuple

import boto3
import httpx
from botocore.exceptions import ClientError

from media_summarizer.utils.logging_config import log_event

logger = logging.getLogger(__name__)

ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
#: The ``pricing_config`` row the beta budget reads (``beta_budget.fx_rate``).
CONFIG_KEY = "eur_usd_rate"

_TIMEOUT_SECONDS = 20.0
#: The daily file is about 1.5 kB; anything far larger is not that file.
_MAX_BYTES = 64 * 1024
#: Bounds outside of which a parsed figure is a misread, not a rate. EUR/USD has
#: stayed between 0.82 and 1.60 since the euro exists.
_MIN_RATE = Decimal("0.5")
_MAX_RATE = Decimal("2.5")
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class EcbRateUnavailable(Exception):
    """The daily file could not be fetched or did not hold a usable USD rate."""


def parse_daily_file(body: bytes) -> Tuple[Decimal, str]:
    """The USD rate and its publication date out of the ECB daily file.

    The file is ``<Cube><Cube time="YYYY-MM-DD"><Cube currency="USD" rate="…"/>…``
    inside the ``gesmes`` envelope; namespaces are ignored on purpose, only the
    ``time``, ``currency`` and ``rate`` attributes are read.
    """
    if len(body) > _MAX_BYTES:
        raise EcbRateUnavailable(f"file of {len(body)} bytes")
    try:
        root = ElementTree.fromstring(body)
    except ElementTree.ParseError as exc:
        raise EcbRateUnavailable("unreadable XML") from exc

    for day in root.iter():
        published_on = day.attrib.get("time")
        if not published_on:
            continue
        if not _DATE.match(published_on):
            raise EcbRateUnavailable(f"unexpected date {published_on!r}")
        for quote in day:
            if quote.attrib.get("currency") != "USD":
                continue
            try:
                rate = Decimal(quote.attrib.get("rate", ""))
            except InvalidOperation as exc:
                raise EcbRateUnavailable("unreadable USD rate") from exc
            if not (_MIN_RATE <= rate <= _MAX_RATE):
                raise EcbRateUnavailable(f"USD rate {rate} out of bounds")
            return rate, published_on
        raise EcbRateUnavailable("no USD rate in the file")
    raise EcbRateUnavailable("no dated rates in the file")


def fetch_daily_rate() -> Tuple[Decimal, str]:
    try:
        response = httpx.get(ECB_DAILY_URL, timeout=_TIMEOUT_SECONDS, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise EcbRateUnavailable(f"fetch failed: {type(exc).__name__}") from exc
    if response.status_code != 200:
        raise EcbRateUnavailable(f"HTTP {response.status_code}")
    return parse_daily_file(response.content)


def write_rate(rate: Decimal, published_on: str, *, table_name: str) -> bool:
    """Write the rate if its date is newer than the stored one. True when written."""
    table = boto3.resource("dynamodb").Table(table_name)
    value = {"usd_per_eur": str(rate), "published_on": published_on, "source": ECB_DAILY_URL}
    try:
        table.update_item(
            Key={"config_key": CONFIG_KEY},
            UpdateExpression="SET config_value = :v, published_on = :p, updated_at = :u",
            ConditionExpression="attribute_not_exists(published_on) OR published_on < :p",
            ExpressionAttributeValues={
                ":v": json.dumps(value),
                ":p": published_on,
                ":u": datetime.now(timezone.utc).isoformat(),
            },
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise
    return True


def handle_event(event: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """The scheduled run. Never raises: a failed refresh keeps the last rate."""
    table_name = os.environ.get("PRICING_CONFIG_TABLE", "")
    try:
        if not table_name:
            raise EcbRateUnavailable("PRICING_CONFIG_TABLE is not set")
        rate, published_on = fetch_daily_rate()
        written = write_rate(rate, published_on, table_name=table_name)
    except Exception as exc:  # noqa: BLE001 - the last rate stays in place (rule 15)
        log_event(
            logger,
            logging.ERROR,
            "fx.ecb_refresh_failed",
            "EUR/USD rate not refreshed; the last stored rate stays in place",
            error_type=type(exc).__name__,
            detail=str(exc)[:200],
        )
        return {"status": "failed"}

    log_event(
        logger,
        logging.INFO,
        "fx.ecb_refreshed" if written else "fx.ecb_unchanged",
        "EUR/USD rate refreshed" if written else "EUR/USD rate already up to date",
        usd_per_eur=str(rate),
        published_on=published_on,
    )
    return {"status": "written" if written else "unchanged", "published_on": published_on}
