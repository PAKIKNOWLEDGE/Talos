# Agent guide

This checkout is the Talos engine fork maintained by `PAKIKNOWLEDGE/Talos-Code-CLI`. The companion product repository is `C:\DEV\develop\T3rra-C0d3-Talos`; it owns the GUI, product documentation, and Endfield-inspired visual layer. This repository owns the CLI/TUI, provider and authentication flow, engine data directories, and the ACP endpoint used by Talos. Keep that boundary explicit: Talos must integrate through ACP and must not import internal engine modules directly.

The fork remains a public-source repository with the existing source inventory, license, and synchronization rules below. A Talos-specific change must be isolated, reviewed, and kept small enough to audit against the public upstream baseline. Do not remove LICENSE, NOTICE, third-party attributions, sandbox boundaries, or permission checks merely to remove product branding. Upstream synchronization is a reviewed operation; do not fetch, merge, push, or open a sync PR unless the current task explicitly authorizes it.

This repository is the reviewed public projection of an internal monorepo, not an ordinary workspace. Every published file is listed in `release/public-source.json`, and upstream changes arrive through a three-way merge described in `docs/source-sync.md`. Moving or renaming files therefore has a cost that a normal repository does not have: it shows up as a conflict or an unreviewed new file at the next synchronization. Prefer changing content over changing layout.

## Layout

- `packages/` — first-party workspace packages. `packages/agent-modules/*` is a second level of packages, not a package itself.
- `third_party/` — vendored upstream packages (`pi-mono`, `sandbox-runtime`) with their own licenses. Their test suites are not part of this distribution's verification.
- `release/` — machine-read release contracts. `extraction.json` pins the source baseline and package scope, `public-source.json` is the file inventory, `dependency-licenses.json` records declared dependency licenses, `talos-release.json` is the npm/GitHub ship procedure. Build, type-check, test resolution, and source checks all read from here.
- `docs/` — human-readable documentation and supporting media. **[docs/status.md](docs/status.md)** is the engine handover card; **[docs/glossary.md](docs/glossary.md)** defines product vs routing names.
- `scripts/` — build and verification tooling. Shared constants live in `scripts/lib/`; import them instead of repeating literal paths or lists.
- `test/` — repository-level tests and `vitest-suites.json`, the declaration of every Vitest file this distribution runs.

## Talos integration boundary

- The GUI repository is `C:\DEV\develop\T3rra-C0d3-Talos`; keep the two repositories adjacent and independent. Do not add a Git submodule or relocate this checkout.
- Talos Desktop should consume this repository through **`talos studio`** (JSON-RPC over stdio; see [docs/studio-protocol.md](docs/studio-protocol.md)). **`talos acp`** remains for editor-style ACP clients. Engine progress and release facts live in this repo's [docs/status.md](docs/status.md). GUI-side evidence is recorded in the companion repo `docs/adapters/talos-engine.md`. Changes to studio/ACP messages, provider selection, authentication, data-directory layout, or TUI behavior require a source citation or reproducible probe before implementation.
- The initial Talos sequence is independent-engine verification, then TUI work, then GUI repair. A fork remote or a clean working tree does not mean the engine has been neutralized or product-accepted.
- Keep user API keys, sessions, logs, and real project content outside the repository. Use a disposable data directory for probes and report whether behavior came from a fake provider or a live model.

## Generated files

Do not edit these by hand; regenerate them and commit the result.

| File | Regenerate with | Checked by |
| --- | --- | --- |
| `release/public-source.json` | `node scripts/source-inventory.mjs --write` | `pnpm check:source` |
| `tsconfig.standalone.json` (the `paths` block) | `pnpm gen:tsconfig` | `pnpm check:tsconfig` |

Review added, removed, and renamed files before regenerating the inventory: recording a file does not make it suitable for publication. Content-only edits to existing files do not require inventory regeneration. Keep private review material, verification reports, and temporary artifacts outside the repository; the inventory scans the working tree, including untracked files outside its explicit exclusions.

## Branches and source synchronization

Use a feature branch and submit a pull request; do not push directly to the default branch. See `CONTRIBUTING.md` for contribution and review requirements. Maintainer npm ships skip GitHub PRs and follow `release/talos-release.json`.

Name new branches by the purpose of the change: `feat/<short-description>` for features, `fix/<short-description>` for bug fixes, and corresponding prefixes such as `docs/`, `refactor/`, `test/`, or `chore/` for other work. Use concise English descriptions in lowercase kebab-case, for example `feat/provider-limits` or `fix/session-restore`. Do not use agent or tool names as branch prefixes, including `codex/`. Follow an explicitly requested branch name when one is provided.

Never merge internal Git history or cherry-pick internal commits into this repository. Follow `docs/source-sync.md`, keep unreviewed candidates outside the repository, and apply reviewed files individually. Advance `release/extraction.json`'s `sourceRevision` only after reviewing all differences for the selected source revision.

## Single sources of truth

| Concern | Declared in | Consumed by |
| --- | --- | --- |
| Package scope | `release/extraction.json` (`packageRoots`) | build, type-check paths, Vitest aliases, source check, source sync |
| Package export → source file | each package's `exports` via `scripts/lib/package-exports.mjs` | `tsconfig.standalone.json`, `vitest.oss.config.mjs` |
| Vitest files per gate | `test/vitest-suites.json` | `vitest.oss.config.mjs`, `scripts/run-vitest-suite.mjs` |
| Retired source paths | `scripts/lib/retired-sources.mjs` | `check:source` (must not exist), `check:standalone` (must not be bundled) |
| Verification pipeline | `scripts/verify.mjs` | GitHub CI, `pnpm verify` |
| Documentation-only classification | `scripts/ci-changes.mjs` | source verification, release audit |
| Source archive validation/extraction | `scripts/lib/source-archive.mjs` | source export, candidate validation |
| Talos npm/GitHub ship | `release/talos-release.json` | maintainers, `docs/releasing.md` |

## Common changes

Adding a workspace package: add it to `pnpm-workspace.yaml` and to `packageRoots` in `release/extraction.json`, then run `pnpm gen:tsconfig` and `node scripts/source-inventory.mjs --write`.

Changing package exports: run `pnpm gen:tsconfig` after adding or changing an export subpath.

Adding a Vitest file: add its path to the appropriate group in `test/vitest-suites.json`. Do not hard-code Vitest file paths in `package.json` scripts or the Vitest config. Repository-level `node:test` suites remain in their existing gates; add workflow safety and release-tool regressions to `test/source-sync.test.mjs`.

Adding a verification gate: add a step to `scripts/verify.mjs`, with `platforms` when it cannot run everywhere. Do not add steps to the workflow file.

## Verification

`scripts/verify.mjs` defines one gate list; CI and local runs select a profile. `pnpm verify --list` shows the gates for the current profile and platform. While editing, run the relevant individual gates (`pnpm typecheck`, `pnpm build`, `pnpm test:byok`, focused Vitest files, and so on).

The default profile is `full` (Linux CI and release validation). On Windows, the applicable pre-PR profile that matches GitHub CI is `pnpm verify --profile windows`, not bare `pnpm verify`: the default still runs the full capability suite, smoke, and BYOK and is much slower. Use bare `pnpm verify` on Windows only for capability-wide changes, Linux-equivalent claims, or release validation. `platform` omits only duplicate type checking on macOS CI. Use `pnpm verify --profile docs` only when every changed path qualifies under `scripts/ci-changes.mjs`; it runs source inventory, generated-path, source-export, and release-tool checks. `AGENTS.md`, bundled runtime prompts, and `release/` changes do not qualify for that profile. `archive` skips Git export for source archives; the candidate workflow authenticates the archive before invoking it. Keep profile selection in the shared verifier.

Source export reads committed `HEAD` and rejects uncommitted tracked changes. On the reviewed commit with a clean tracked working tree, run the applicable profile before opening a PR. Report the checks actually run and any blocked or untested boundaries. Offline tests do not establish live-service or cross-platform acceptance.

## Boundaries

Do not reference internal hosts, generated IDL, or private services; `check:source` catches known patterns but does not replace publication review. Do not restore paths listed in `scripts/lib/retired-sources.mjs` or remove supported capabilities to make standalone checks pass. Do not commit account data, sessions, logs, credentials, or real user content; use temporary data directories and synthetic test inputs. Documentation and commit messages are written in English; preserve the required languages of localized product strings and bundled runtime prompts. See `CONTRIBUTING.md`.
