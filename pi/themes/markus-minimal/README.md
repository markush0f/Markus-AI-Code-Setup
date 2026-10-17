# Markus Minimal

A minimal dark theme and information extension for Pi. No extra dependencies or special fonts. Messages, tools, editor controls, and keyboard shortcuts remain unchanged.

## Install permanently

Run once from this folder:

```sh
./install-theme.sh
```

The installer registers this local package and saves `markus-minimal` as your default theme in `~/.pi/agent/settings.json` (or the directory set by `PI_CODING_AGENT_DIR`). Existing settings are preserved, and a backup is created before writing. Repeated runs do not duplicate the package.

Then open `pi` normally, or run `/reload` in an existing session. Do not move this folder afterward: Pi loads the package from this location. Project-specific settings may override your personal default theme.

Avoid loading multiple extensions that replace the header or footer. If `~/.pi/agent/extensions/minimal-ui.ts` overrides this interface, disable it through `pi config`. The installer warns about this file but does not disable it automatically.

## Try without changing saved settings

From this folder:

```sh
pi --no-extensions -e ./extensions/index.ts \
  --theme ./themes/markus-minimal.json --use-theme markus-minimal
```

Other extensions are disabled **only for this invocation**, preventing interface conflicts. Explicit resources still load. Saved settings remain unchanged.

From any project:

```sh
THEME="$HOME/Documentos/Markus-AI-Code-Setup/pi/themes/markus-minimal"
pi --no-extensions -e "$THEME/extensions/index.ts" \
  --theme "$THEME/themes/markus-minimal.json" --use-theme markus-minimal
```

### Manual package installation

```sh
pi install "$HOME/Documentos/Markus-AI-Code-Setup/pi/themes/markus-minimal"
```

Select **markus-minimal** in `/settings` → Theme. Use `/reload` if Pi was already open.

### Uninstall

```sh
pi remove "$HOME/Documentos/Markus-AI-Code-Setup/pi/themes/markus-minimal"
```

Select another theme in `/settings` if the removed theme is still selected. Installer backups are retained for manual recovery.

## Interface

Illustrative example; actual values come from Pi:

```text
pi / project · 1.3.0 · /minimal-info

[native conversation and editor]

 ready  model / high                              $0.0240 est.
 in 12.5k out 2.1k                     ctx 20.0% 40.0k/200.0k
 ~/project @ main                   tools 12 err 0  4m 12s
```

- Live turn status and active tools, including parallel calls.
- Current model and reasoning level as `model / high`; provider is available in `/minimal-info`.
- Estimated context usage and capacity; warning at 75%, alert at 90%.
- Input/output tokens and estimated cost; cache details stay in `/minimal-info`.
- Working directory, Git branch, completed tools, errors, and time open.
- Queued-message indicator and statuses published by other extensions, except Langfuse.
- Three core rows with one-column side insets, two-column group separators, and no blank padding rows.
- Cost aligns right, with context directly beneath it; tools/errors and time share the project row's right side. When a pair cannot fit, groups stack without overlap. Insets disappear below 24 columns. Oversized individual groups are truncated using Unicode-aware terminal columns.

### Commands

| Command | Action |
| --- | --- |
| `/minimal-info` | Show session name, file, ID, API, limits, compactions, project trust, and active tools. Navigate with the native selector controls; Esc closes. |
| `/minimal-toggle` | Restore Pi's built-in header/footer or enable this package's interface again. Does not change the theme or restore another extension's interface. |

## Palette

Green-tinted graphite, light gray text, and a sage accent. Color communicates hierarchy and state. Successful tools do not leave permanent green panels; diffs and failures remain distinct. The editor and its controls remain native.

**Recommended terminal background: `#111613`; foreground: `#E3E6E3`.** A Pi theme cannot set the entire terminal background. This package colors Pi panels and supplies matching HTML export backgrounds; it does not change terminal settings.

## Data and limitations

- `?` means Pi does not currently provide the value, for example immediately after compaction.
- Usage and cost totals cover assistant messages on the **active branch**, not abandoned branches. Prices come from Pi and are estimates, not invoices or subscription balances. Additional usage recorded separately by tools is not included.
- Completed-tool counts reflect tool-result messages retained on the branch. Nested calls appear while running but do not increase this count unless they have their own result message.
- Totals can decrease after compaction removes messages from the available branch. This is not a persistent financial ledger.
- Time open measures this session opening. Last-turn duration measures the agent cycle, not provider latency or generation speed.
- No credential access, network requests, or child processes. Component disposal clears timers and subscriptions.
- No terminal components are installed in print, JSON, or RPC modes.
- Labels supplied by other extensions and user-provided session names are displayed as received, not translated.

## Development

```sh
npm test
```

To include integration tests against a real Pi installation:

```sh
PI_HOST_ROOT="$HOME/.pi/agent/install/releases/1.3.0/node_modules/@earendil-works/pi-coding-agent" npm test
```

Verified with Pi **1.3.0**: official schema, real extension loader, widths of 1/20/40/80/120/200 columns, wide characters, parallel tools, commands, and cleanup. Appearance has not been visually inspected in a real terminal emulator.
