"""Cost arithmetic for task-427: ask-a-question artifact vs conversational chat.

Pure arithmetic, no network. Running compute.py regenerates every figure cited
in README.md. Prices are catalogue USD per 1M tokens, consulted 2026-10-05 on
https://developers.openai.com/api/docs/pricing and on the per-model pages. The
EUR conversion uses the same USD_EUR = 0.86 as task-65 and
media_summarizer/core/services/llm_pricing.py, so every figure here is directly
comparable with the ones already in the repo.

Written without dict or set literals on purpose: the sandbox that produced this
file rejects a heredoc containing curly braces.
"""

from math import ceil

USD_EUR = 0.86

# (model, input, cached input, output) in USD per 1M tokens
PRICES = [
    ("gpt-5-nano", 0.05, 0.005, 0.40),
    ("gpt-5.4-nano", 0.20, 0.02, 1.25),
    ("gpt-6-luna", 0.10, 0.01, 0.50),
]

# --- Corpus sizes ----------------------------------------------------------
# 16 500 tokens per hour of speech: measured end to end on a 77.85 min podcast
# (pricing-challenge section 3.9). 4 622 tokens = median transcript on -dev
# (task-269 section 1.2). 120 000 = MAX_FOLDER_CORPUS_TOKENS
# (artifact_service.py line 125).
C_1H = 16_500
C_MEDIAN_SOURCE = 4_622
C_3H = 49_500
C_CEILING = 120_000

OVERHEAD = 400          # preamble, per-source headers, question instructions
QUESTION = 60           # a typical question
ANSWER_VISIBLE = 400    # what the user reads

# Two completion regimes. "none" is reasoning_effort=none, the documented
# default of gpt-5.4-nano. "default" is what an unbounded reasoning budget
# actually costs, anchored on the measured median of summary_short on -dev
# (2 678 completion tokens for about 300 visible tokens of JSON).
OUT_NONE = 450
OUT_DEFAULT = 2_700

MINUTE_EUR = 0.00664        # pricing_config_service.py line 157, declared
CREDIT_EUR = 0.005          # pricing-challenge R.2, proposed scale
TOKENS_PER_MINUTE = 20_000  # proposed question_context_tokens_per_minute
TPM_TIER1 = 200_000         # gpt-5-nano and gpt-5.4-nano, Tier 1


def prices_for(model):
    for name, pin, pcached, pout in PRICES:
        if name == model:
            return pin, pcached, pout
    raise KeyError(model)


def eur(model, fresh_in, cached_in, out):
    pin, pcached, pout = prices_for(model)
    usd = (fresh_in * pin + cached_in * pcached + out * pout) / 1_000_000
    return usd * USD_EUR


def out_tokens(regime):
    return OUT_NONE if regime == "none" else OUT_DEFAULT


def one_shot(corpus, model="gpt-5.4-nano", regime="none", cached=False):
    """Voie A: one question, one answer, nothing reinjected."""
    total_in = corpus + OVERHEAD + QUESTION
    out = out_tokens(regime)
    if cached:
        # Only the corpus and overhead prefix can be cached, rounded down to 128.
        c = ((corpus + OVERHEAD) // 128) * 128
        return eur(model, total_in - c, c, out)
    return eur(model, total_in, 0, out)


def conversation(corpus, turns, model="gpt-5.4-nano", regime="none", cached=True):
    """Voie B: full corpus prefix plus full history, turn by turn.

    With caching, the prefix of turn k is exactly the input of turn k-1, because
    a conversation only ever appends. So the fresh part of turn k is the previous
    answer plus the new question. Without caching every turn pays the whole
    prefix again.
    """
    out = out_tokens(regime)
    total = 0.0
    history = 0
    prev_in = 0
    rows = []
    for k in range(1, turns + 1):
        total_in = corpus + OVERHEAD + history + QUESTION
        c = (min(prev_in, total_in) // 128) * 128 if (cached and prev_in) else 0
        cost = eur(model, total_in - c, c, out)
        total += cost
        rows.append((k, total_in, c, cost, total))
        history += QUESTION + ANSWER_VISIBLE
        prev_in = total_in
    return total, rows


def thread_no_history(corpus, turns, model="gpt-5.4-nano", regime="none",
                      cached=True):
    """Voie C: a thread of independent questions, history never reinjected."""
    out = out_tokens(regime)
    total = 0.0
    for k in range(1, turns + 1):
        total_in = corpus + OVERHEAD + QUESTION
        c = ((corpus + OVERHEAD) // 128) * 128 if (cached and k != 1) else 0
        total += eur(model, total_in - c, c, out)
    return total


def e(x):
    return "%.6f" % x


def main():
    print("=" * 86)
    print("1. One question, one answer (voie A), gpt-5.4-nano, EUR")
    print("=" * 86)
    print("%-28s %11s %11s %11s %11s" % (
        "corpus", "none/cold", "none/cache", "def/cold", "def/cache"))
    rows = [
        ("median -dev source (4 622)", C_MEDIAN_SOURCE),
        ("1 h media (16 500 tk)", C_1H),
        ("3 h podcast (49 500 tk)", C_3H),
        ("folder ceiling (120 000)", C_CEILING),
    ]
    for label, c in rows:
        print("%-28s %11s %11s %11s %11s" % (
            label,
            e(one_shot(c)),
            e(one_shot(c, cached=True)),
            e(one_shot(c, regime="default")),
            e(one_shot(c, regime="default", cached=True)),
        ))

    print("")
    print("Same question on the three candidate models, effort=none:")
    for name, _pin, _pc, _pout in PRICES:
        print("  %-13s 1 h cold %s   ceiling cold %s   ceiling cached %s" % (
            name,
            e(one_shot(C_1H, model=name)),
            e(one_shot(C_CEILING, model=name)),
            e(one_shot(C_CEILING, model=name, cached=True)),
        ))

    print("")
    print("=" * 86)
    print("2. Conversation (voie B), gpt-5.4-nano, reasoning_effort=none, EUR")
    print("=" * 86)
    for label, c in (("1 h media", C_1H), ("folder ceiling", C_CEILING)):
        print("")
        print("  %s, corpus %d tk" % (label, c))
        print("  %6s %11s %11s %12s %18s" % (
            "turns", "no cache", "cached", "cache gain", "voie C cached"))
        for n in (1, 5, 10, 20):
            nc, _ = conversation(c, n, cached=False)
            wc, _ = conversation(c, n, cached=True)
            nh = thread_no_history(c, n)
            gain = (wc / nc - 1) * 100 if nc else 0.0
            print("  %6d %11s %11s %11.1f%% %18s" % (
                n, e(nc), e(wc), gain, e(nh)))

    print("")
    print("  Same at reasoning_effort=default, 2 700 completion tokens per turn")
    for label, c in (("1 h media", C_1H), ("folder ceiling", C_CEILING)):
        cached = [e(conversation(c, n, regime="default", cached=True)[0])
                  for n in (1, 5, 10, 20)]
        cold = [e(conversation(c, n, regime="default", cached=False)[0])
                for n in (1, 5, 10, 20)]
        print("  %-16s cached 1/5/10/20: %s" % (label, ", ".join(cached)))
        print("  %-16s   cold 1/5/10/20: %s" % (label, ", ".join(cold)))

    print("")
    print("=" * 86)
    print("3. Turn by turn, folder ceiling, cached, effort=none")
    print("=" * 86)
    _, rows3 = conversation(C_CEILING, 20, cached=True)
    print("  %4s %10s %10s %10s %10s" % (
        "turn", "input tk", "cached tk", "cost", "cumulative"))
    for k, total_in, c, cost, cumul in rows3:
        if k in (1, 2, 3, 4, 5, 10, 20):
            print("  %4d %10d %10d %10s %10s" % (
                k, total_in, c, e(cost), e(cumul)))
    hist20 = 19 * (QUESTION + ANSWER_VISIBLE)
    print("  history after 20 turns: %d tk = %.1f%% of the ceiling corpus, "
          "%.1f%% of a 1 h media" % (
              hist20, hist20 / C_CEILING * 100, hist20 / C_1H * 100))

    print("")
    print("=" * 86)
    print("4. Quota: what one minute of allowance buys")
    print("=" * 86)
    print("  %-28s %8s %10s %11s %9s" % (
        "first turn over", "minutes", "billed", "worst cost", "coverage"))
    for label, c in (
        ("1 h media (16 500)", C_1H),
        ("3 h podcast (49 500)", C_3H),
        ("folder, 10 median sources", 10 * C_MEDIAN_SOURCE),
        ("folder ceiling (120 000)", C_CEILING),
    ):
        minutes = max(1, ceil(c / TOKENS_PER_MINUTE))
        billed = minutes * MINUTE_EUR
        worst = one_shot(c, regime="default")
        print("  %-28s %8d %10s %11s %8.0f%%" % (
            label, minutes, e(billed), e(worst), billed / worst * 100))
    for label, c in (("1 h media", C_1H), ("folder ceiling", C_CEILING)):
        _, rows4 = conversation(c, 2, cached=True, regime="default")
        follow = rows4[1][3]
        print("  %-28s %8d %10s %11s %8.0f%%" % (
            "follow-up turn, " + label, 1, e(MINUTE_EUR), e(follow),
            MINUTE_EUR / follow * 100))
    worst_miss = one_shot(C_CEILING, regime="default")
    print("")
    print("  Cache miss on a follow-up at the ceiling: %s EUR for 1 min billed, "
          "coverage %.0f%%" % (e(worst_miss), MINUTE_EUR / worst_miss * 100))
    print("  In credits at %.3f EUR: 1 credit per %d context tokens, "
          "1 credit per follow-up turn" % (
              CREDIT_EUR, int(TOKENS_PER_MINUTE * CREDIT_EUR / MINUTE_EUR)))

    print("")
    print("=" * 86)
    print("5. Does it fit a Standard subscriber")
    print("=" * 86)
    session, _ = conversation(C_1H, 5, cached=True, regime="default")
    charged = max(1, ceil(C_1H / TOKENS_PER_MINUTE)) + 4
    print("  one 5-turn session over a 1 h media: real cost %s EUR, "
          "charged %d min = %s EUR" % (
              e(session), charged, e(charged * MINUTE_EUR)))
    tiers = [
        ("mix, deployed, 5 EUR", 300, 3.542),
        ("Standard, proposed, 5 EUR", round(360 * CREDIT_EUR / MINUTE_EUR), 3.542),
        ("audio_heavy, deployed, 9 EUR", 720, 6.375),
    ]
    for label, minutes, net in tiers:
        budget = minutes * MINUTE_EUR
        sessions = minutes / charged
        real = sessions * session
        print("  %-28s %4d min = %.3f EUR of budget, %.0f%% of net %.3f EUR" % (
            label, minutes, budget, budget / net * 100, net))
        print("      whole allowance spent on chat: %.0f sessions per month, "
              "real cost %.3f EUR = %.1f%% of net" % (
                  sessions, real, real / net * 100))

    print("")
    print("=" * 86)
    print("6. Rate limit check, Tier 1 = 200 000 TPM on both nano models")
    print("=" * 86)
    for label, c in (("1 h media", C_1H), ("3 h podcast", C_3H),
                     ("folder ceiling", C_CEILING)):
        turn = c + OVERHEAD + QUESTION
        print("  %-16s one turn = %7d tk = %5.1f%% of a Tier 1 minute, "
              "%d turns per minute at most" % (
                  label, turn, turn / TPM_TIER1 * 100, TPM_TIER1 // turn))
    burst = 5 * (C_CEILING + OVERHEAD)
    print("  for reference, the 5 artifact types over a folder at the ceiling = "
          "%d tk = %.1fx a Tier 1 minute, already true today" % (
              burst, burst / TPM_TIER1))


if __name__ == "__main__":
    main()
