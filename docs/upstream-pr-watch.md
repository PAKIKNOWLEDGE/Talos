# Upstream pull request watch (MiniMax Code)

This fork tracks public upstream at `https://github.com/MiniMax-AI/minimax-code`. Integration uses the selective three-way process in [source-sync.md](source-sync.md), not direct merges of upstream PRs.

## Review cadence

| Activity | Suggested interval | Owner |
| --- | --- | --- |
| Scan open upstream PRs (titles + draft state) | **Every 2 weeks** before a Talos npm release, or when planning selective sync | Maintainer |
| Full selective sync (`prepare-source-sync` + review) | **Quarterly**, or when a reviewed upstream revision bundles multiple fixes you need | Maintainer |
| Emergency intake | **Ad hoc** only when a fix is security-critical, data-loss, or blocks a promised Talos release | Maintainer + explicit scope |

Upstream merges **10+ open PRs** in bursts (example: 2026-10-09 morning UTC had several new drafts). A **2-week** pre-release scan catches new work without reacting to every draft. **Quarterly** full sync matches typical fork drift when Talos-specific changes stay small.

Do **not** merge upstream during a Talos feature slice unless the pre-release scan finds a **blocking** issue (see below).

## Pre-release gate (before `pnpm release:cli`)

1. Run `gh pr list --repo MiniMax-AI/minimax-code --state open --limit 30`.
2. Classify each open PR: `draft`, `fix`, `feat`, `deps`, age.
3. Record the snapshot in **Review log** below (date, reviewer, decision).
4. **Merge upstream into this fork only if** a PR is merged upstream *and* classified **P0** for Talos (security, corruption, auth bypass, or regression you already ship). Otherwise **record only**; port via selective sync on a separate branch.
5. Proceed with Talos release only after the log entry says `release: proceed` or `release: proceed after upstream port <ref>`.

## P0 vs record-only

| Tier | Examples | Action |
| --- | --- | --- |
| **P0** | RCE, credential leak, session DB corruption, ACP protocol break affecting Desktop | Stop release; selective sync or cherry-pick reviewed files; re-verify |
| **P1** | Provider outage fix, Linux install break, compaction 413 loop | Schedule selective sync within 2 weeks; optional patch release |
| **Record** | Draft PRs, TUI polish, sandbox modes, dependabot minors | Note in log; no merge before npm |

## Review log

| Date | Talos release line | Upstream snapshot | P0 found? | Decision |
| --- | --- | --- | --- | --- |
| 2026-10-09 | 0.1.3 (ACP `session/delete`) | Open: #462–#460 drafts (413/retry, effort, body limit), #459 draft (reminders perf), #364 Linux/XDG, #319 SQLite contention, #317 model persist, #307 BYOK env, #255 sandbox modes, #186 endpoint query, dependabot #146/#145 | **No** | **release: proceed** — no merged upstream emergency; drafts not intake. Re-check before next npm. |
| 2026-10-10 | 0.1.4 (`talos studio` v2) | Open: #471 OSC status, #468 dependabot tooling, #364 Linux/XDG, #319 SQLite, #317 model persist, #307 BYOK env, #255 sandbox, #186 endpoint query, #146/#145 deps | **No** | **release: proceed** — no P0 merged upstream; record-only. |
| 2026-10-19 | 0.1.5 (welcome notes + selective ports) | Same open set as the 2026-10-19 issue #3 review: #500 #499 #493 #364 #319 #317 #307 #255 #186 #146 #145. Merged since 10-12: #492 #487 #484 #471. | **No** | **release: proceed** — ports are selective; no upstream main merge. |
| 2026-10-21 | 0.1.6 (Auto LLM permission judge) | Open: #500 #499 tooling/actions deps, #364 Linux/XDG, #319 SQLite, #317 model persist, #307 BYOK env, #255 sandbox, #186 endpoint query, #146/#145 deps. No new merged P0 since 0.1.5. | **No** | **release: proceed** — record-only; Talos judge work is local. |
| 2026-10-22 | 0.1.7 (optional Collapsal TUI skin) | Open: #500 #499 tooling/actions deps, #364 Linux/XDG, #319 SQLite, #317 model persist, #307 BYOK env, #255 sandbox, #186 endpoint query, #146/#145 deps. No new merged P0 since 0.1.6. | **No** | **release: proceed** — record-only; Collapsal is local TUI. |
| 2026-10-23 | 0.1.8 (TUI boot sound) | Same open set as 0.1.7. No new merged P0. | **No** | **release: proceed** — record-only; local TUI audio. |
| 2026-10-23 | 0.1.9 (Collapsal permission footer) | Open: #500 #499 tooling/actions deps, #364 Linux/XDG, #319 SQLite, #317 model persist, #307 BYOK env, #255 sandbox, #186 endpoint query, #146/#145 deps. Same open set as 0.1.8. No new merged P0. | **No** | **release: proceed** — record-only; local TUI footer. |
| 2026-10-23 | 0.1.10 (pluggable web_search) | Open: #500 #499 tooling/actions deps, #364 Linux/XDG, #319 SQLite, #317 model persist, #307 BYOK env, #255 sandbox, #186 endpoint query, #146/#145 deps. Same open set as 0.1.9. No new merged P0. | **No** | **release: proceed** — record-only; local search backends. |
| 2026-10-28 | 0.1.11 (Collapsal notes + TUI session wipe) | Open: #550 autocompact, #538 execution-budget reminder, #528/#499 deps, #364 Linux/XDG, #319 SQLite, #317 model persist, #307 BYOK env, #255 sandbox, #186 endpoint query, #146/#145 deps. No merged P0. | **No** | **release: proceed** — record-only; TUI-only. |
| 2026-10-30 | 0.1.12 (welcome note order, /rules, deny guidance) | Open: #550 autocompact, #538 execution-budget reminder, #528/#499 deps, #364 Linux/XDG, #319 SQLite, #317 model persist, #307 BYOK env, #255 sandbox, #186 endpoint query, #146/#145 deps. Merged since 0.1.11: #553 code-sdk. No merged P0. | **No** | **release: proceed** — record-only; local TUI and permission reply. |

## References

- Pinned baseline: `release/extraction.json` → `sourceRevision`
- Selective intake example: [source-sync-0.5.5.md](source-sync-0.5.5.md)
- Talos npm ships: [`release/talos-release.json`](../release/talos-release.json)
