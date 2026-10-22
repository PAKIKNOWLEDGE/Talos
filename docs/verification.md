# Verification records

## Initial repository import, 2026-09-18

The reviewed 0.4.12 CLI snapshot was imported at `c59cf5377045aa1a3e699c242d089b73b7cdc2ad` on top of the existing MiniMax Code Desktop support history. Commit `4e2e7bb5f771e9c42b2edefb1046483819b9032f` restored the Desktop image above the download links. The resulting tree ID, `327eb838c8bdc3da70d9e5f165ca6162a1d15545`, matched the reviewed source tree, and internal Git history was not imported.

Before import, `pnpm verify` passed all 14 applicable gates at implementation revision `1670bafd684ebf8dbb03dd41330ac2b099ffaf23` on macOS arm64 with Node.js 26.4.0 and pnpm 9.12.0, including 3,352 capability tests. History, exported-source, and built-distribution Gitleaks scans completed without unaddressed findings. Issue-form routing and Feishu payload generation used synthetic offline inputs and sent no notification.

Windows CI exposed fixture teardown races during preparation. The fixes drain background delivery before closing SQLite, normalize temporary paths for the Vitest runner, and require image-preview Workers to exit cleanly. These changes affect test fixtures and shutdown checks, not product behavior.

On the imported commit, the Linux and macOS Source verification jobs passed; the Windows job was cancelled by the immediate README follow-up. The follow-up passed the documentation profile and Release audit. A future source release still needs a completed final-revision platform matrix, Node compatibility run, and source candidate.

## Dependency security and unused implementation cleanup, 2026-09-18

The standalone workspace pins Vitest and its coverage package to 4.1.11, Vite to 7.3.6, Hono to 4.13.5, and Ajv's fast-uri to 3.1.6 through root overrides. The runtime uses smol-toml 1.7.1. Central overrides also cover vendored workspace development dependencies without rewriting upstream manifests. The suite launcher resolves the executable from Vitest's package manifest because the newer package no longer exports its CLI as a module subpath.

The TOML import regression runs the actual AgentImportService in a bounded child process: valid input succeeds, while comments ending unterminated arrays or inline tables are rejected. A subprocess timeout prevents a synchronous parser regression from hanging the test runner.

The unused Team cycle engine and two unreferenced adapters are removed. Legacy queue, lock and run-location modules retain the compatibility types required by shared adapters; their unused implementations are removed in place. The source inventory, package paths, lockfile and declared dependency licenses are regenerated. This change does not claim live-service acceptance or alter the repository's publication scope.

## Current source verification status

The current source target is TUI **0.4.12**, with the separate versions described in [Source status](open-source-status.md#version-and-evidence-baseline). The import results above are the current repository baseline. The 0.3.11 results below remain a historical record and have not been relabeled as current acceptance.

Fresh login/logout, cross-platform interactive acceptance, and a validated three-platform source candidate remain **NOT RUN / unavailable** for the imported revision. Add later results with their revision, environment, and scope instead of replacing the historical record.

### Source synchronization verification, 2026-09-18

The reviewed shared-source baseline is `9b9885e42a3cf1a3df1cfa52a46e4fdb034cfcee` (TUI 0.4.12). The standalone projection preserves its process-local protocol and public service configuration. Desktop HTTP/generated transports, cloud handoff, private packaging, and unrelated desktop additions remain excluded.

`pnpm verify` passed all 14 gates on macOS arm64, Node.js 26.4.0 and pnpm 9.12.0: source inventory (4,210 files), generated paths (121 exports), source export, release tooling (13 tests), typecheck, build, standalone boundary, built artifacts (4 tests), capabilities (2,679 tests), status contract (9 tests), CLI/ACP smoke (7 tests), offline BYOK (1 test), permission policy (115 tests), and macOS sandbox (48 tests). The artifact checks start the packaged image-preview Worker, and the sandbox suite includes real `sandbox-exec` and Git probes.

The expanded regressions cover model effort, headless preparation cancellation and response usage, image previews, MCP naming and cancellation, background Bash, prompt/agent storage, provider discovery, and content-safety V2. Image-header fixtures are synthetic; production-request images are excluded. Secret scanning covers all Git refs, the exported source, and build artifacts; the test token uses an explicit short placeholder.

Windows/Linux execution, fresh managed-account login, real provider calls, and live content-safety V2 endpoints were not run locally. Offline BYOK fixtures do not establish live-model acceptance. This synchronization does not publish an npm release or change repository visibility.

### Release-preparation verification, 2026-09-12

`pnpm verify` was run on `3de31f0e365e635c52d661c0a14c9ee69e65f099` in an isolated worktree after a frozen-lockfile install, on macOS arm64 with Node.js 26.4.0 and pnpm 9.12.0.

| Gate | Result |
| --- | --- |
| Source inventory, workspace exports and native helper integrity | PASS: 4,096 reviewed files |
| Generated TypeScript paths | PASS: 119 exports |
| History-free source export | PASS |
| Release tooling | PASS: 13 tests |
| Full typecheck | FAIL: `packages/tui/src/cli/network-proxy.ts:134`, TS2724; installed Undici 8 exposes `Dispatcher.DispatchHandler`, while the source references `Dispatcher.DispatchHandlers` |
| Build, standalone checks, artifact/capability/status/smoke/BYOK/policy/sandbox tests | NOT RUN: the full verifier stopped at typecheck |

The failing source file and dependency lockfile are unchanged from the reviewed base `edbd4bd483f9326fae14bed6852950f371d4feab`. At that revision, the preparation changed release metadata, attribution and contributor documentation without repairing the runtime/dependency mismatch. The follow-up below resolves it. A documentation-profile pass must not be substituted for full current-source acceptance.

### Merge-review follow-up, 2026-09-12

Commit `67ad241fb201c618bdedfba5998f7a6fb6f1d0cf` updates the proxy dispatcher's handler annotation to `Dispatcher.DispatchHandler`, matching Undici 8's installed `dispatch` signature. It forwards the handler unchanged and changes no runtime behavior.

On that commit, `pnpm verify` **passed all 14 applicable gates** on macOS arm64, Node.js 26.4.0, pnpm 9.12.0: source checks, generated paths, history-free export, release tooling, typecheck, build, standalone checks, artifact/capability/status/smoke/BYOK/policy/sandbox tests. The capability suite passed 412 tests; the existing real macOS sandbox probes also passed. Local Gitleaks scans of complete Git history, the committed source snapshot and the built distribution reported no findings with the reviewed `.gitleaks.toml` rules.

This resolves the local typecheck failure recorded above. It does not establish Windows/Linux acceptance, successful GitHub Actions runs, a three-platform source candidate or fresh live-service acceptance. Release prerequisites remain separate from this local verification result.

## Historical TUI 0.3.11 acceptance

Verification date: 2026-09-11. Environment: macOS arm64, Node.js 26.4.0, pnpm 9.12.0. Capability baseline: TUI 0.3.11.

This record preserves the clean-directory baseline from managed-capability restoration and adds private release review evidence. Passing tests do not mean all online services have passed acceptance; live evidence appears below and in `release-audit.md`.

## Clean-directory acceptance

Final source was copied outside the repository without `.git`, `node_modules`, `dist`, or `.cache`. A new pnpm store and public npm only were used for a frozen-lockfile install. The build downloaded the pinned MCode package again and extracted mcode-tools without reusing development artifacts.

| Check | Result |
| --- | --- |
| Cold install from public npm | Passed, approximately 1 minute 15 seconds |
| Source inventory, internal references, workspace exports, native helper integrity | Passed, 3979 files at this baseline |
| TypeScript check of the complete entry point | Passed |
| Standalone build and dependency boundaries | Passed; key managed capabilities remained in the output |
| Login, leases, accounts, plugins, connectors, feedback, updates, ACP, Matrix configuration | 21 explicitly selected test files; 321 tests passed |
| Original mcode-tools archive / file hashes, tamper rejection, actual CLI startup | 3 passed |
| CLI, providers, SQLite, ACP initialization, internal-switch rejection, offline local plugins | 7 passed |
| BYOK, session resume, actual file tools, managed-model authentication gate | 1 passed |
| Existing permission facade | 115 passed |
| Vela status protocol | 9 passed |
| Sandbox, executable resolution, actual macOS file / Git probes | 48 passed |

**504 automated tests passed** in total, with relevant validation completed in both development and clean directories.

The BYOK test uses a local OpenAI-format protocol server to drive the actual runtime. It verifies authorization headers, resume history, and real file contents in subsequent model requests, while ensuring Token Plan model overrides still require login. It does not establish real provider quality or production availability.

After managed capabilities were restored, startup could request the model catalog and telemetry. Offline tests return local 503 responses for an explicit public-service allowlist, recording attempts without sending them. Unknown addresses and unexpected TCP connections still fail tests. This verifies some unavailable-service behavior; those failures are not counted as live-service successes.

## Real TUI inspection

A real PTY with an isolated data directory and the network guard confirmed:

- Welcome shows Token Plan as unauthenticated.
- `/provider` presents both MiniMax OAuth / Token Plan and API key options.
- `/login` opens a cancellable China / international region selector.
- `/plugins` shows a clear error for an injected 503. Successful loading and source switching have component / application coverage; this manual check did not connect successfully to the official marketplace.
- `/exit` exits normally and restores terminal state.

That offline PTY check did not open a browser or call a real model. Subsequent online acceptance with an existing account is recorded separately below.

## Private release preparation additions

- Three tests cover source synchronization candidates, preservation of public changes, conflicts, and unsafe-output rejection. A no-change comparison against the actual baseline reported zero changes.
- Full-history, source-snapshot, and build-artifact Gitleaks scans were added. GitHub `Release audit` passed; see `release-audit.md` for false-positive handling and case sanitization.
- Initial Windows CI exposed Git CRLF conversion affecting native helper hashes. `.gitattributes` now pins LF. Later fixes addressed POSIX temporary paths, mock install layouts, and cmd quoting in tests. The relevant 70 tests passed locally; use PR checks for final platform results.
- At that time, GitHub ran macOS / Windows / Linux × Node.js 22 / 24. Each job included frozen install, source checks, source export, build, boundaries, tool artifacts, the 321-case capability suite, status protocol, smoke, and BYOK. Type checking ran once in the Linux / Node.js 22 full profile; the other five jobs used the platform profile, omitting only that compiler gate. Windows skipped one POSIX-only capability case. Permission facade tests ran outside Windows; actual sandbox probes ran on macOS. GitHub runner success did not constitute an interactive user-path check on each physical platform.

## Live production-account acceptance

Using the user-authorized existing login and dedicated temporary workspaces, the following were confirmed:

- A Token Plan MiniMax-M3 session succeeded; resume recovered the previous marker.
- BYOK provider connectivity and a real model session succeeded.
- Events confirmed a successful actual `web_search` call. A separate response that returned a URL without calling the tool was not counted.
- The official plugin marketplace returned 54 available plugins.
- Real bash → mcode-tools → host-lease authentication succeeded. Connector discovery returned 13 tools with no provider failures.

Actual service responses, credentials, and local account paths were not committed. The recorded acceptance results summarize sessions run with synthetic inputs; they do not claim business calls for every plugin or generation tool.

## Not yet verified

- Fresh browser login / logout, full membership quota and billing validation, paid media generation, website deployment, new third-party connector grants / business writes, and feedback / diagnostic uploads.
- Interactive TUI user paths on Windows and Linux; GitHub runner builds and tests are recorded separately.
- Actual update installation / upgrade; the development machine's global installation was not changed.
- Real task quality for each bundled skill, and Desktop features outside the original TUI's defaults.

This historical acceptance did not publish the GitHub source repository or an npm package. The official npm product has a separate release history; its currently verified version is listed in [Source status](open-source-status.md). TypeScript remains strict; `noUncheckedIndexedAccess` and `noImplicitOverride` retain the vendored libraries' existing compatibility settings.

## Windows timeout investigation, 2026-09-12

On commit `4e7582c`, the Windows / Node.js 22 BYOK fixture exceeded its 35-second child-process deadline; the other six CI checks passed. The original failure reported only `Timed out: exec`, without the command phase or captured output, so it does not establish whether execution or process shutdown stalled.

The fixture now records per-command duration, bounded stdout / stderr and execution progress on timeout, plus an opt-in unreferenced process-resource probe. It waits for child `close` before reading complete output, and force-terminates timed-out children before cleanup. The 35-second deadline, 90-second overall bound, default text output, and BYOK / resume / actual-file assertions remain. No runtime behavior or timeout was relaxed. Use the latest PR run for the result; a passing follow-up does not by itself explain the earlier timeout.

## Native NixOS verification, 2026-10-03

This record was submitted from the NixOS machine in commit de5c44b and covers Talos source revision d395b6d (0.1.1). It is a source-workspace run, not a separate npm installation report. On 2026-10-06, normal model-driven use on that machine was confirmed to work without observed failures. Real use and automated checks are recorded separately.

### Reported environment

Linux 6.18.38 x64 (NixOS), Node v24.16.0, pnpm 9.12.0 via nix-shell. Dependency installation completed with native builds for node-pty, better-sqlite3 and esbuild. The run used LC_ALL=C and LANG=C, and unset TALOS_NEUTRAL_RUNTIME. A registry mirror was used after slow downloads from the default registry. These are the conditions of this run, not prerequisites for every user.

### Reported gate results

| Gate | Result | Detail |
| --- | --- | --- |
| check:source | PASS | 4,286 reviewed files |
| check:tsconfig | PASS | 128 package exports |
| export source preview | PASS | Source-only export completed |
| test:release-tools | PASS | 68 passed, 1 platform skip |
| lint:tui | PASS | Completed |
| typecheck | PASS | Completed |
| build | PASS | Talos 0.1.1 built |
| check:standalone | PASS | Completed |
| test:artifact | PASS | 4 passed |
| test:capabilities | FAIL | Reported 5,068 passed, 18 skipped and 1 failed |
| test:status-contract | PASS | 11 passed |
| test:smoke | PASS | 20 passed, 1 skipped |
| test:byok | FAIL | 3 completed, 1 cancelled on timeout |
| test:policy | PASS | 156 passed, 6 skipped |

Twelve gates passed; two did not. This is not an overall successful full-profile verification. Counts and diagnostics come from the submitted record; raw per-gate receipts were not added to this documentation commit. Successful everyday use does not erase test failures, and the test failures do not establish a failure in the reported everyday use.

### Remaining check limitations

- The command-environment test reported exit 127 with “dirname: command not found”. Its fixture uses a deliberately restricted PATH and copies the shipped POSIX launcher. The reported outcome is consistent with a NixOS fixture portability limitation. It is not proof that every production launch path has been validated. dirname is an external command, not a shell builtin.
- The BYOK scenario was cancelled within its time limits. Slow startup was proposed in the submitted record; no complete startup trace was attached to establish the cause. Keep the cause unresolved rather than claiming cold-start latency is proven or that other suites replace this end-to-end scenario.

Disposition, 2026-10-06: retain both outcomes as known verification limitations. Do not change tests, relax limits or rerun the full suite solely to make this record green. No failure was observed in the confirmed model-driven NixOS use, so these checks are not being added as a new blocker for that use. Revisit only with a concrete failure report or an explicit validation task.

### Evidence boundary

The automated run reports local fixtures and no paid model requests. The later real-use confirmation is a separate user observation; its provider, request counts and project contents are not recorded here. This record does not claim npm installation coverage, all-provider compatibility, or a complete platform matrix.

Two conversation-experience observations are reserved for a later task: [follow-up scope](superpowers/plans/2026-10-03-nixos-followup.md). No prompt, runtime or test changes are part of accepting this record.

## Local verification profiles, 2026-10-08

Documentation and `scripts/verify.mjs` now state explicitly that **bare `pnpm verify` on Windows runs the `full` profile** (capabilities, smoke, BYOK) and is slower than GitHub’s Windows job, which uses `pnpm verify --profile windows`. Pre-PR checks on Windows should use `--profile windows` unless the change needs Linux-equivalent capability coverage or release validation. See `AGENTS.md`, `CONTRIBUTING.md`, and the testing-workflow skill.

## Talos prompt identity rebrand, 2026-10-07

Scope: pull request #1 (branch `fix/prompt-talos-identity`) rebranded the bundled agent prompt identity. Merged to `main` at `c3ee558` (2026-10-08). Shipped on npm as **`@pakiknowledge/tal0s-code@0.1.2`** (tag `v0.1.2`, version commit `70445a8`). The initial prompt-only commit on that branch was `cacce79`. The agent persona is now **Perlica** (replacing Mavis, whose name was documented as "MiniMax As a Jarvis"), and runtime product references in the prompts now say **Talos** (replacing MiniMax Code). Ten asset files changed: the four `_v2` system/surface templates (`tui`/`coding`/`work` SYSTEM, `AGENT_CONTEXT`) and the six persona assets. Two test files updated their asset-content assertions in lockstep; one docs plan file was added and the source inventory was regenerated. Internal identifiers (`builtin-agents.json` roster, `@mavis/*` package names, `managed-prompts.json` path keys, capability flags) were deliberately not renamed.

### Local verification

`pnpm verify` (full profile) **PASS** at revision `cacce79` on Windows x64, Node v24.15.0, elapsed 598.9s: check:source (4,288 files), check:tsconfig, source export, release tools, lint, typecheck, build, standalone, artifact, capabilities, windows, windows-policy, status-contract, smoke, and byok all passed; `test:policy`, `test:sandbox`, and `test:release-package` were intentional platform/condition skips. Focused during iteration: catalog and agent repository suites (130 tests), `check:source`, `typecheck`.

### Owner acceptance session (2026-10-07, partial fail)

The owner ran the built CLI from the branch with a real model and asked about identity. The rebranded prompt claims took effect: the model introduced itself as **Perlica**, a coding agent running in the Talos terminal. The session nevertheless leaked internal identifiers: the model additionally stated that the current session's agent name is "Mavis" with role "orchestrator".

### Owner re-acceptance (after routing-field removal, pass)

After the follow-up repair (tool rename to `talos`, `PRIMARY_AGENT_DISPLAY_NAME`, and removal of `agentName` / `agentRole` from local `<agent-context>`), the owner re-ran interactive identity Q&A on a built CLI from this branch. **Pass:** the model introduced itself as Perlica/Talos and did not report the session agent as "Mavis" with role "orchestrator" from injected turn context. This is owner acceptance of the identity leak fix, not a full platform or live-service matrix.

### Root cause (resolved by transcript evidence)

The owner's acceptance session transcript pinned the leak precisely. The user turn carried a `<agent-context>` system-reminder containing:

    agent: Mavis  # display name
    agentName: mavis  # routing ID
    agentRole: orchestrator  # agent type

built by `packages/agent-modules/system-reminder/src/blocks.ts:105-114`, with the display name coming from the hardcoded seed `DEFAULT_LOCAL_AGENT_DISPLAY_NAME = "Mavis"` (`packages/local-runtime/src/api/host.ts:290`). Two further model-visible surfaces carried the same identity: the tool named `mavis` (`packages/agent-tools/src/desktop/builtin-defs.ts:946`, with "the built-in mavis agent" twice in its description), and the greeting reminder's `agent_name:` fact. The earlier conversation-experience follow-ups (standalone waiting replies; internal labels in documents) remain open and are corroborated by this acceptance session.

### Repair (implemented the same day)

Repair option B from [prompt identity follow-ups](superpowers/plans/2026-10-07-prompt-identity-followups.md), plus a guardrail:

- The model-visible tool is renamed `mavis` → `talos` (`builtin-defs.ts`), its description scrubbed ("the built-in mavis agent" → "the primary agent"), and every name-keyed consumer updated: the native tool feature filter (`local-native-tool-filter.ts`), the V2 turn tool catalog gates (`local-turn-tool-catalog.ts`), the desktop output-limit continuation union, and the local-mavis continuation hint.
- The display-name seed is now `Perlica` (`PRIMARY_AGENT_DISPLAY_NAME`); the V2 agent service pins `primaryDisplayName` at owner creation so stale stored `"Mavis"` identity rows cannot override the public name in reminders or `agent get`.
- Local `<agent-context>` (first turn and slim follow-ups) no longer injects `agentName:` or `agentRole:`; routing values remain in memory for gating only. The greeting reminder's `agent_name` fact prefers the display name.
- Prompt-asset examples call the tool as `talos({ ... })`; low-risk skill prose ("Mavis runtime", "Mavis-managed", "normal Mavis agent execution") was neutralized.
- A later sink sweep on the same branch updated leftover model-visible `mavis({ ... })` examples in `local-mavis.ts` help, system-reminder blocks, cron self-reminder text, and agent-request-ref schema descriptions so they match the renamed `talos` tool. Internal routing keys were left unchanged.

Remaining model-visible internal keys are deliberately unchanged (routing contracts): the `mavis` agent key, the `skills.mavis`/`features.mavis` flags and the built-in skill keyed `mavis`, `mavis-doctor`, `mavis-trash`, `MAVIS_SCRATCHPAD`, and the `lark-tools` CLI command references. Tool JSON may still expose routing fields such as `name: mavis` or `agentRole: orchestrator`; that is separate from turn `<agent-context>` injection. The `minimax-code-product` skill rewrite remains a separate task.

### Repair verification

Offline: `blocks.identity.test.ts` asserts assembled local `<agent-context>` strings omit `agentName: mavis` and `agentRole: orchestrator` while keeping `agent: Perlica`. Focused iteration on this branch also passed local-native tools and agent catalog/repository suites. Owner re-acceptance after routing-field removal is recorded above (pass).

`pnpm verify` (full profile) **PASS** at revision `892bf9f` on Windows x64: 15 applicable gates green (`check:source` 4,290 files, tsconfig, export, release tools, lint, typecheck, build, standalone, artifact, capabilities, windows, windows-policy, status-contract, smoke, byok); intentional skips `test:policy`, `test:sandbox` (macOS-only), `test:release-package` (requires npm release archive). Elapsed ~13.6 minutes.

### Delivery (2026-10-08)

- **Git:** PR #1 merged to `main`; `main` and tag `v0.1.2` at `70445a8` (0.1.2 version bump only on top of the identity merge).
- **npm:** `@pakiknowledge/tal0s-code@0.1.2` published from a reviewed tarball built at that tag (local publication path; upstream GitHub npm publish script remains disabled for Talos).
- **Package profile:** `pnpm verify --profile package` was attempted twice on Windows during publication; both runs failed on BYOK resume at the 90s test timeout after tarball install succeeded. Full source `pnpm verify` had already passed at `892bf9f`. Treat package-profile BYOK on a loaded Windows host as **NOT RUN / flaky** for this release unless rerun clean.

### Boundary

This record covers offline suites plus interactive owner-run acceptance on Windows. It does not claim a live-service matrix or other-platform interactive acceptance. npm **0.1.2** carries the identity repair for installs from the public registry. The research background for the rebrand is recorded in [harness prompt research](superpowers/plans/2026-10-07-harness-prompt-research.md).

## ACP session delete (0.1.3)

Scope: ACP `session/delete` with `sessionCapabilities.delete`, detach-if-attached then `runtime.deleteSession`; `session/close` unchanged. Merged to `main` at `4837477` (2026-10-09). Shipped as **`@pakiknowledge/tal0s-code@0.1.3`** (tag `v0.1.3`, version commit `0972c18`).

### Verification

- Vitest `packages/tui/test/unit/acp-agent.test.ts`: **109/109** pass.
- `pnpm verify --profile windows` **PASS** at `4837477` (~92s).
- Pre-release upstream scan: [upstream-pr-watch.md](upstream-pr-watch.md) 2026-10-09 — **release: proceed** (no P0).

### Delivery (2026-10-09)

- **Git:** `feat/acp-session-delete` fast-forwarded to `main`; version bump via `release/v0.1.3` merged to `main` (`gh pr create` failed on token permissions; merged with git).
- **npm:** `@pakiknowledge/tal0s-code@0.1.3` published from tarball built at `v0.1.3` (local path per [releasing.md](releasing.md)).
- **GitHub Release:** [v0.1.3](https://github.com/PAKIKNOWLEDGE/Talos-Code-CLI/releases/tag/v0.1.3) with `.tar.gz` + `.sha256`.

## Auto LLM permission judge (0.1.6)

Scope: replace MiniMax `POST /mavis/api/v1/permission/check` with a user-configured LLM judge (`/settings`, aliases `/options` `/选项`). Local PermissionEngine first; Claude HARD/SOFT policy; judge refusal and failures become ask with Why. Thinking-model empty `content` is read from reasoning. Auto `web_fetch` policy asks go through the judge.

### Verification

- Focused Vitest: permission-judge config, LLM judge client, local-permission-facade (including Auto `web_fetch`), TUI judge settings, packaged changelog 0.1.6 notes.
- `pnpm verify --profile windows` **PASS** at `06f5598` (~80s): 10 gates on win32. Skipped typecheck/capabilities/status/smoke/BYOK/policy/sandbox/package (not in the Windows contract).
- Pre-release upstream scan: [upstream-pr-watch.md](upstream-pr-watch.md) 2026-10-21 — **release: proceed** (no P0).
- Live probes are owner-run on a disposable workspace; unit tests do not call a live model.

### Delivery (2026-10-21)

- **Git:** `feat/auto-llm-judge` fast-forwarded to `main` (`gh pr create` failed on token permissions; merged with git). Version commit `320c5d4`, tag `v0.1.6`.
- **npm:** `@pakiknowledge/tal0s-code@0.1.6` published from the tarball built at that tag (local path per [releasing.md](releasing.md)). Registry processing may take a few minutes.
- **GitHub Release:** [v0.1.6](https://github.com/PAKIKNOWLEDGE/Talos-Code-CLI/releases/tag/v0.1.6) with `.tar.gz` + `.sha256`.

## Optional Collapsal TUI skin (0.1.7)

Scope: boot-frozen Collapsal interface (Classic remains default). `/settings` Interface page; fullscreen pinned header; slimmer default footer; user bubbles and hairline separators. Color themes still change live with `/theme`.

### Verification

- Focused Vitest: TUI skin settings and picker, status-line Collapsal defaults, composer bubbles, welcome header, transcript presentation, packaged changelog 0.1.7 notes.
- `pnpm verify --profile windows` **PASS** at `2c3b3c1` (~104s): 10 gates on win32. Skipped typecheck/capabilities/status/smoke/BYOK/policy/sandbox/package (not in the Windows contract).
- Pre-release upstream scan: [upstream-pr-watch.md](upstream-pr-watch.md) 2026-10-22 — **release: proceed** (no P0).
- Known follow-ups not in this release: Collapsal full-bleed background, splash source image.

### Delivery (2026-10-22)

- **Git:** `feat/collapsal-skin` fast-forwarded to `main` (`gh pr create` still fails on `CreatePullRequest`; merged with git). Version commit `2b5385a`, tag `v0.1.7`.
- **npm:** `@pakiknowledge/tal0s-code@0.1.7` published from the tarball built at that tag (local path per [releasing.md](releasing.md)). Registry processing may take a few minutes.
- **GitHub Release:** [v0.1.7](https://github.com/PAKIKNOWLEDGE/Talos-Code-CLI/releases/tag/v0.1.7) with `.tar.gz` + `.sha256`.

## Interactive TUI boot sound (0.1.8)

Scope: play a short PCM WAV when the interactive TUI starts. All skins. Skip login-restart. Windows SoundPlayer; Linux pw-play/paplay; fail-silent. Welcome notes copy 0.1.7 Collapsal bullets and add the sound.

### Verification

- Focused Vitest: startup-sound policy/spawn, packaged changelog 0.1.8 notes.
- Windows: heard from `pnpm start` after non-detached spawn. Linux/NixOS untested (fail-silent).
- `pnpm verify --profile windows` on the feature revision. Results recorded at merge.
- Pre-release upstream scan: [upstream-pr-watch.md](upstream-pr-watch.md) 2026-10-23 — **release: proceed** (no P0).
