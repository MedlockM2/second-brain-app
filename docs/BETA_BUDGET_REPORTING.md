# Internal beta usage, costs and refusals

TASK-552 uses `beta_budget-<env>`, not a second financial counter or an analytics
service. The owner decision remains TASK-547, rules 5, 8, 12, 13 and 14. The 5 EUR
allowance is unchanged. This report is operational and private; it is never an
endpoint, a public dashboard, or a tester-facing amount.

## Run and export

From the repository root, using its Python environment and an AWS profile with
`dynamodb:Scan` on the explicit environment's budget table:

```sh
.venv/bin/python scripts/beta_budget_report.py \
  --profile second-brain-app --region eu-west-3 --table beta_budget-dev \
  --from 2026-10 --through 2026-12 \
  --cohort-file /private/tmp/deepn-private/cohorts.json \
  --output-dir /private/tmp/deepn-private/report
```

The cohort file is a **private JSON mapping of internal account IDs** to `beta`
or `fixture`. Populate it from the enrollment/fixture list; never infer a cohort
from an email, a subscription, the AWS environment or activity. Omitted accounts
remain `unknown`. Without this file, the command still runs and explicitly labels
all accounts unknown. `--cohort beta|fixture|unknown|all` selects a cohort.
No identity or credential belongs in a command, a tracked manifest or a task note.

`report.json` contains the account-month rows, distributions, provider/component
breakdowns, billed quantities and following-month activity. `account-months.csv`
is the corresponding export for a spreadsheet. Files are mode 0600; newly created
directories are 0700. The command refuses destinations inside **any** Git checkout
(even ignored paths), refuses output symlinks, and prints only the number of rows.
Keep exports outside this public repository. Do not paste exports into backlog
notes or commit them. Rerunning replaces the two derived files; it changes no AWS
data. It reads every scan page with strongly consistent base-table reads. At beta
scale this operator-run scan is sufficient; its RCU cost is proportional to the
retained ledger, not just the requested months. It reads no user/profile table.

## Definitions and limits

| Indicator | Definition |
|---|---|
| Operations and retries | Distinct operation IDs per account/month; attempts with `try_number > 1` are retries. An operation may span months, and page/image parts remain distinct attempts. |
| Automatic | `review_blurb` and `translation` components (including qualified image parts). They belong to the import/reading operation, not another user request. |
| Consumed, held, available, returned capacity | The existing month counter, as stored. Missing counters are null. Returned capacity is released reservations, **not** cash refunded. Consumption alone is the tester's displayed percentage. |
| Capped | Settled consumption at least the period budget. Separate from an account whose reservation did not fit or temporarily holds its remaining capacity. |
| Budget refusals | Observed `budget_exhausted` events, with other causes counted separately. A bound may fail even while some capacity remains. These are demand events, not proof of actual costs forgone. |
| Blocked days | Distinct UTC dates with observed budget refusals. Not days since the first refusal, days without activity, or a measured duration: `total_blocked_duration` is null. Several retries on one day add events, not days. |
| After recharge | Following-month operations observed for accounts with a prior refusal. The `recharges` section identifies whether the next month is inside the report window; outside it the count is null. This includes automatic retries and proves activity, not a fresh user intent. |
| Provider cost | Settled **non-reuse** attempts plus operator cost on released attempts. Charged reuse consumes capacity but invokes no provider, so it never adds another provider cost. |
| Measured vs estimated | Stored cost basis and `metric_source`. `estimated` stream usage and a failed call priced at its bound stay estimated. A not-sent call is a known zero; missing/open amounts or missing provenance remain unknown, and the total is null when any cost is unknown. Known subtotals remain readable, not a claim of complete spend. |
| Volumes | Provider `usage` totals per cohort/provider/component. Missing usage increments `missing_usage_attempts`, not a fabricated zero. Reserved `quantities` are upper bounds, never billed volumes. |
| Distributions | Nearest-rank p50/p90/p95/p99/p100 of account-month values. Unknown totals are excluded; empty populations return null percentiles. Cohort filtering applies before all aggregation. |
| Reconciliation | Counter identity `available = budget − held − consumed`, and sums of settled/open attempts. These are readable audit indicators, **not** an instruction to overwrite a counter. Reads are not a transactionally frozen snapshot; recent writes, TTL and account erasure can explain a gap. Re-read a quiescent period before investigating. |

All financial values are normal-tariff valuations at the attempt's recorded FX
rate. They are not provider invoices or cash debits: promotional balances, free
volumes, provider rounding and invoice timing can differ. Fixed infrastructure is
outside this ledger. `consumed + operator_spend` includes charged reuse, and must
never be presented as a provider bill. No operation is priced by its failed
forecast as though it had run. No manual capacity reset is introduced.

## Evidence and lifecycle

Attempts already record provider/model, component, quantities, try, reservation,
settled/released state, usage, tariff/FX and cost provenance. Paid reuse has its own
`reuse` attempt. The guard now records refusals at precheck, import admission,
admission, worker start and content reuse. One exception passing through nested
gates produces one observation. Separate requests/redeliveries can produce several
demand events; operation counts and refusal-event counts are different measures.
Free artifact reuse and re-filing already-held content add `reused` observations,
without creating a financial attempt. No event records a raw provider payload,
source content, prompt, URL or account login.

Observations use the same user partition, account-erasure path, PITR and 400-day
TTL as the existing ledger. Closed attempts expire after 400 days; counters after
period end + 400 days. Open reservations never expire by TTL. There is no backfill
of old fixtures or of demand before deployment. An observation write is
best-effort: a ledger outage cannot record itself there. `beta_budget.observed`
remains a log fallback; `beta_budget.observation_failed` is alarmed. Logs retain
their existing retention (14 days on the audit Lambda). An empty report or zero
refusal rows is **not** proof of an unused service or lossless collection.

## Alarms and response

`infrastructure/terraform/modules/platform/beta_budget_alerts.tf` filters the API,
every SQS worker, and the audit Lambda into separate, undimensioned metrics in the
existing namespace. No high-cardinality user/operation dimensions are introduced.
When `enable_alarms` is on, ALARM and OK go to the existing `pipeline_alerts` SNS
topic and its configured operational recipients. Retrieve recipients through the
environment's Terraform/SNS configuration; no address is recorded here.

| Alarm / metric | Trigger and response |
|---|---|
| `budget-control` / `BetaBudgetControlAnomalies` | Any ledger/config/settlement/observation failure, missing payer, unknown settlement or conflicting close in 5 minutes. Inspect the structured event; restore the counter's storage/permissions/configuration before allowing paid calls. Never turn failure into free admission. |
| `budget-measurement` / `BetaBudgetMeasurementAnomalies` | Any settled estimated usage or failed in-flight call with no cost metric in 5 minutes. Inspect `metric_source`, `cost_basis`, provider logs and the attempt; reconcile the operator's valuation. A bounded estimate is not a measured invoice. |
| `budget-overrun` / `BetaBudgetOverrunAnomalies` | Any measured settlement above its hold in 5 minutes. Residual overruns are accepted by rule 8: investigate the measurement/barème, do not mask the actual cost or add capacity. |
| `budget-stale` / `BetaBudgetStaleAnomalies` | An open reservation older than the configured `hold_expiry_minutes`. Inspect its worker/DLQ and the existing release/backstop path. No silent deletion or direct counter edit. |
| `budget-audit-missing` / `BetaBudgetAuditCompleted` | No completed audit in two consecutive 30-minute periods. Check schedule, image, IAM, duration and logs. Missing monitoring is not healthy monitoring. |

The audit runs every 30 minutes, paginates **only** the sparse open-attempt index,
and reads the `beta_access` config row to use the same expiry as the admission
backstop. It emits a completion heartbeat only after the full scan. Its own role
has log writes, read access to the budget table/index and GetItem on that single
config row. It has no ledger writes, runtime secret, provider credential or user
content access. The image receives shared resource **names** so modules import,
as does the ECB Lambda; names grant no additional IAM access. Deployment uses the
existing shared worker image and Environment-tag discovery. It never releases a
reservation or changes a user's capacity.

## Owner checks after merge/deployment (TASK-440)

- Apply the environment Terraform, deploy the shared image including the audit
  entrypoint, and confirm the 30-minute schedule produces its heartbeat.
- Exercise the alarm/OK notifications through the existing operational channel.
  Verify filters and the missing-heartbeat alarm against real CloudWatch events.
- Enroll/classify beta accounts and fixtures in the private cohort manifest, run
  the report outside Git, and inspect measured/estimated/unknown breakdowns.
- Observe a refused request, a retry, an automatic step, a release and following
  month activity on dev. These deployed checks are not worktree acceptance gates.
