# Talos

**A coding agent for your terminal. Bring your model, work in your project, and follow every step.**

[简体中文](README_ZH.md) · [Install](#install) · [Quick start](#quick-start) · [npm](https://www.npmjs.com/package/@pakiknowledge/tal0s-code)

![Talos welcome screen](docs/assets/talos-welcome.jpg)

Talos helps you explore a codebase, edit files, and run commands through a terminal conversation. Replies, tool activity, and permission requests stay next to the work. Classic is the default interface; `/settings` can switch to Collapsal after a restart. Choose a provider preset or connect your own compatible endpoint.

## Install

Requires Node.js **22.19–22.x, 24.2–24.x, 25.x, or 26.x**.

```sh
npm install -g @pakiknowledge/tal0s-code@latest --registry=https://registry.npmjs.org/ --ignore-scripts=false --include=optional
```

Install scripts are needed for native dependencies. Keep optional dependencies enabled.

## Quick start

Open a terminal in the project you want to work on:

```sh
cd /path/to/your/project
talos
```

1. Enter `/provider` to configure a model connection. Select a preset or supply your endpoint, model name, and API key.
2. Describe your task and the result you want. For example: “Explain how this project starts, then identify the files involved.”
3. Follow the replies and tool activity. Review permission requests when prompted. In Auto, `/settings` can point those asks at your own LLM judge.

Model usage is billed by your chosen provider.

![A conversation in Talos](docs/assets/talos-session.png)

*Collapsal welcome (Classic remains the default). The wallpaper and transparency are terminal settings.*

## Keep working

| Command | Use |
| --- | --- |
| `talos "Explain this repository"` | Start with a task. |
| `talos --continue` | Continue the latest session in the current workspace. |
| `talos --session` | Choose a session. |
| `talos exec "Explain this repository"` | Run a task without the interactive interface. |
| `talos acp` | Connect an Agent Client Protocol client. |
| `talos studio` | Studio JSON-RPC server for Desktop (stdio). |
| `talos --help` | View command-line options. |

Inside Talos, use `/provider` for model connections, `/settings` (also `/options`) for the LLM judge and Classic/Collapsal interface, `/sessions` for history, and `/help` for commands and shortcuts.

## Your data

Configuration and sessions are stored in `~/.talos` by default (`%USERPROFILE%\.talos` on Windows). Uninstalling the npm package leaves this directory intact.

## Updates

Run `talos update` or enter `/update` to check for a new version. Talos shows the upgrade command; installation is always manual. To upgrade, run the npm install command above again.

Release notes: [0.1.12](docs/releases/0.1.12.md) · [0.1.11](docs/releases/0.1.11.md) · [0.1.10](docs/releases/0.1.10.md) · [0.1.9](docs/releases/0.1.9.md).

## Release status

Talos **0.1.12** is the current CLI line (`@pakiknowledge/tal0s-code`). This patch shows Welcome notes in changelog order, adds `/rules` to view, filter, and delete saved permission rules, and sends a typed deny reason to the model. Enter during a live reply stops that reply and sends the draft. Recent 0.1.x work also includes Collapsal System notes, `/sessions` permanent delete, pluggable Web search, and a user-configured LLM permission judge in Auto. Classic stays the default skin. Windows x64 release checks passed on this line. See [verification records](docs/verification.md) and [current status](docs/status.md).

The desktop GUI lives in the companion repository `T3rra-C0d3-Talos`.

If you encounter a problem, [open an issue](https://github.com/PAKIKNOWLEDGE/Talos-Code-CLI/issues) with your OS, Node.js version, Talos version, and the error message. Remove API keys and private project content before sharing logs.

## Build from source

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and verification, and [source synchronization](docs/source-sync.md) for maintaining the fork.

## License and acknowledgements

Talos builds on open-source work from [MiniMax Code](https://github.com/MiniMax-AI/minimax-code), [pi-mono](https://github.com/badlogic/pi-mono), and other contributors. Copyright and license notices are retained in [LICENSE](LICENSE), [NOTICE](NOTICE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and [LEGAL.md](LEGAL.md).
