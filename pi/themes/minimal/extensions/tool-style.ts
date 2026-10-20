import type { ToolRenderers } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// Decorate presentation only. Native renderers still own streaming, errors,
// images, truncation warnings, timers, and the full expanded result.
export function compactToolRenderers(native: ToolRenderers, isEnabled: () => boolean): ToolRenderers {
  if (!native.renderResult) return native;
  const components = new WeakMap<object, ReturnType<NonNullable<ToolRenderers["renderResult"]>>>();
  return {
    ...native,
    renderResult(result, options, theme, context) {
      const component = native.renderResult!(result, options, theme, {
        ...context, lastComponent: components.get(context.state),
      });
      components.set(context.state, component);
      if (!isEnabled() || options.expanded || options.isPartial || context.isError
        || result.content.some(block => block.type !== "text")
        || result.details?.truncation?.truncated || result.details?.fullOutputPath) return component;
      const output = result.content.filter(block => block.type === "text")
        .map(block => block.text).join("\n").trim();
      const lines = output ? output.split("\n").length : 0;
      const elapsed = Number.isFinite(context.durationMs)
        ? ` · ${(context.durationMs! / 1000).toFixed(1)}s` : "";
      return new Text(theme.fg("muted", `done${elapsed} · ${lines} ${lines === 1 ? "line" : "lines"} · expand for output`), 0, 0);
    },
  };
}

// Agent shell calls are actions: amber prompt, plain command, muted output.
// User-typed ! commands stay on Pi's green bashMode path.
export function shellCallRenderers(
  native: ToolRenderers,
  isEnabled: () => boolean,
  prompt: string,
  compact: boolean,
): ToolRenderers {
  const renderers = compact ? compactToolRenderers(native, isEnabled) : native;
  if (!native.renderCall) return renderers;
  return {
    ...renderers,
    renderCall(args, theme, context) {
      const component = native.renderCall!(args, theme, context);
      const command = args?.command;
      if (!isEnabled() || typeof command !== "string" || command.length === 0
        || !component || !("setText" in component)) return component;
      const timeout = typeof args?.timeout === "number" ? theme.fg("muted", ` (timeout ${args.timeout}s)`) : "";
      component.setText(theme.fg("warning", theme.bold(prompt)) + " " + theme.fg("text", command) + timeout);
      return component;
    },
  };
}
