# Design: information without decoration

Operate mode. Preserve Pi's structure and extend the existing minimal theme's approach: dark neutrals, readable text, and semantic states. The user confirmed dark mode; the native editor is not redesigned.

## Implemented system

- Reference background #111613; panel #1B211E; text #E3E6E3.
- Secondary text #B1B8B3; subdued text #8C9690; sage accent #A9C7C2.
- Success #ACC8A0; warning #DFBF88; error #E3A19A.
- User's terminal font and cursor. No emoji or Nerd Font requirements.
- Single-line header. Borderless footer with three core rows and no blank padding rows: identity/cost, tokens/context, project/tools/time.
- Footer spacing: one terminal column of horizontal inset (none below 24 columns), two columns between groups. Other extension statuses follow without a blank separator; Langfuse statuses are hidden.
- Left: activity and `model / reasoning`, input/output tokens, project/branch. Right: cost, context directly below cost, tools/errors/time/queue. Provider and cache details remain in /minimal-info rather than the footer.
- Preserve information priority at narrow widths: stack left/right groups when their gap would be below two columns, wrap whole groups and truncate only individual groups that cannot fit.
- Context warning at 75%, error at 90%. Missing values use a question mark, not invented zeros.
- No custom animation. Preserve the native working indicator; update the clock once per second.
- Extended information uses the native selector without modifying conversation history.
- All project-owned text is English. External labels, session names, paths, and identifiers are preserved as received.

## Review

Schema validation and real extension loading against Pi 1.3.0. Tests cover actual Pi Unicode-width utilities, parallel tools, cleanup, commands, and non-terminal mode. Technical review was performed in the main workflow; no subagent or interactive capture tool was available. Final appearance still requires human review in the user's terminal. No claim of visual verification or universal perfection across terminal emulators is made.
