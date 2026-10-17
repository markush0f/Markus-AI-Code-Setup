# Markus Minimal

## Platform and stack

A terminal extension for Pi: TypeScript and a JSON theme. An independent local package inside Markus-AI-Code-Setup/pi/themes, using Pi's runtime without a compilation step.

## Confirmed requirements

An extremely minimal dark theme with as much available information as possible. Keep it as a separate project inside Markus-AI-Code-Setup/pi/themes. All project-owned interface labels, scripts, comments, and documentation must be in English.

## Constraints

Preserve native conversation behavior, editor controls, tool execution, and keyboard shortcuts; presentation may be customized. Show only available data and identify estimates and missing values. The extension complements the palette because a JSON theme cannot add telemetry. Do not change existing settings without authorization.

## Implementation decisions

Three compact persistent information rows wrap according to terminal width without blank padding. A native-editor subclass styles borders without replacing controls. Successful read/bash output collapses to summaries, with native details on expansion and native error/streaming/image/truncation rendering. Additional details are available through /minimal-info. Cost and token totals cover the active branch and do not represent an invoice. No extra external dependencies or fonts.

## Persistent installation

The user requested a permanent default-theme installer. install-theme.sh saves the local package registration and default theme, preserves other settings, and creates a backup. Creating or testing the script does not itself install the theme into the user's real configuration.
