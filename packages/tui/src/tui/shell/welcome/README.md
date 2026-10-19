# Welcome UI maintenance

Welcome separates design assets, layout, and terminal mechanics. Designers generally only need to edit this directory.

- `design.ts` is the single visual configuration entry point: character logo, wordmark, slogan, tips, news, and responsive hero thresholds.
- `component.ts` owns wide, stacked, and compact layouts, not theme detection or runtime lifecycle.
- `hero.ts` maps design assets to the current theme's gradient hero. Change it only when adjusting responsive selection or coloring.

Welcome and `/changelog` share the local changelog bundled with the package. `CHANGELOG.md` is the English default and fallback; `CHANGELOG.zh-CN.md` is the Chinese version. The npm build copies both files next to `cli.js`. A system locale with language `zh` selects Chinese; other languages select English. For each release, add that version's heading at the top of both files, above upstream history, and provide at least three entries per language for Welcome. The first heading for a version is the one Welcome shows.

The hero renders the six-row Unicode block `TALOS` wordmark beside the GUI's three-hexagon emblem at 64 columns or more, a single-line `TALOS` title above the emblem at 20–63 columns, and a two-row micro mark at 10–19 columns. Below 10 columns it falls back to `T`. The emblem uses plain ASCII so it remains legible without color or a special terminal font. The wordmark is a checked-in literal asset generated from the reviewed ANSI Shadow style source; no runtime font package is required. The frame header still carries the normal-size product name for status context.

Shared colors live in `src/tui/theme/palettes.ts`; borders and terminal-width adaptation live in `src/tui/shell/frame.ts`. Initial theme detection and rendering gates belong to infrastructure in `src/tui/theme/render-binding.ts` and `src/tui/renderer/interactive-renderer.ts`. Do not add startup sequencing to Welcome.

Validate copy, colors, and artwork visually. For responsive layout, visibility, or state changes in this standalone repository, run the relevant test from the repository root:

```bash
pnpm exec vitest run --config vitest.oss.config.mjs packages/tui/test/unit/tui-shell-chrome.test.ts
```
