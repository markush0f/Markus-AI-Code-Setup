import { homedir } from "node:os";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { clean, duration, footerRows, summarize } from "./layout.mjs";

export default function minimal(pi: ExtensionAPI) {
  let ctx: ExtensionContext;
  let enabled = true;
  let started = Date.now();
  let runStarted = 0;
  let lastRun = 0;
  let busy = false;
  let stats = summarize([]);
  const running = new Map<string, string>();
  let repaint: (() => void) | undefined;
  let readBranch: (() => string | null) | undefined;
  let readStatuses: (() => string[]) | undefined;

  const refresh = (context: ExtensionContext) => {
    ctx = context;
    stats = summarize(ctx.sessionManager.getBranch());
    repaint?.();
  };
  const activity = () => running.size
    ? `${[...new Set(running.values())].map(clean).join(", ")} (${running.size})`
    : busy ? "working" : "ready";
  const path = () => {
    const home = homedir();
    return ctx.cwd === home ? "~" : ctx.cwd.startsWith(home + "/") ? "~" + ctx.cwd.slice(home.length) : ctx.cwd;
  };
  const snapshot = () => {
    const usage = ctx.getContextUsage();
    return {
      busy, activity: activity(), model: ctx.model?.id ?? "no model",
      provider: ctx.model?.provider ?? "no provider", thinking: pi.getThinkingLevel(),
      percent: usage?.percent ?? null, contextTokens: usage?.tokens ?? NaN,
      contextWindow: usage?.contextWindow ?? ctx.model?.contextWindow ?? NaN,
      stats, path: path(), branch: readBranch?.(), elapsed: Date.now() - started,
      queued: ctx.hasPendingMessages(), statuses: readStatuses?.() ?? [],
    };
  };

  function mount() {
    if (ctx.mode !== "tui") return;
    ctx.ui.setHeader((_tui, theme) => ({
      invalidate() {},
      render: (width) => [truncateToWidth(
        theme.fg("accent", "pi") + theme.fg("muted", ` / ${clean(basename(ctx.cwd))}`)
          + theme.fg("dim", ` · ${VERSION} · /minimal-info`), width)],
    }));
    ctx.ui.setFooter((tui, theme, data) => {
      repaint = () => tui.requestRender();
      readBranch = () => data.getGitBranch();
      readStatuses = () => [...data.getExtensionStatuses()]
        .filter(([key, text]) => !/langfuse/i.test(clean(key) + " " + clean(text)))
        .map(([, text]) => text);
      const unsubscribe = data.onBranchChange(repaint);
      // Timer belongs to the component, so reload/toggle/shutdown disposes it.
      const timer = setInterval(() => tui.requestRender(), 1000);
      timer.unref();
      return {
        invalidate() {},
        render: (width) => footerRows(snapshot(), width, {
          fg: (token, value) => theme.fg(token, value),
          fit: truncateToWidth, measure: visibleWidth,
        }),
        dispose() {
          clearInterval(timer);
          unsubscribe();
          repaint = undefined;
          readBranch = undefined;
          readStatuses = undefined;
        },
      };
    });
  }

  pi.on("session_start", (_event, context) => {
    started = Date.now();
    running.clear(); busy = false; lastRun = 0;
    refresh(context);
    if (enabled) mount();
  });
  pi.on("session_tree", (_event, context) => refresh(context));
  pi.on("session_compact", (_event, context) => refresh(context));
  pi.on("model_select", (_event, context) => { ctx = context; repaint?.(); });
  pi.on("thinking_level_select", (_event, context) => { ctx = context; repaint?.(); });
  pi.on("agent_start", (_event, context) => {
    ctx = context; busy = true; runStarted = Date.now(); repaint?.();
  });
  pi.on("agent_end", (_event, context) => {
    lastRun = Date.now() - runStarted;
    busy = false; running.clear(); refresh(context);
  });
  pi.on("message_end", (_event, context) => refresh(context));
  pi.on("tool_execution_start", (event, context) => {
    ctx = context; running.set(event.toolCallId, event.toolName); repaint?.();
  });
  pi.on("tool_execution_end", (event, context) => {
    ctx = context; running.delete(event.toolCallId); repaint?.();
  });
  pi.on("session_shutdown", () => {
    running.clear(); busy = false;
    // Pi owns component disposal, including its interval and branch subscription.
    if (ctx?.mode === "tui" && enabled) {
      ctx.ui.setFooter(undefined);
      ctx.ui.setHeader(undefined);
    }
  });

  pi.registerCommand("minimal-toggle", {
    description: "Toggle between Markus Minimal and the built-in Pi interface",
    handler: async (_args, context) => {
      ctx = context;
      if (ctx.mode !== "tui") return;
      enabled = !enabled;
      if (enabled) { refresh(context); mount(); }
      else { ctx.ui.setHeader(undefined); ctx.ui.setFooter(undefined); }
      ctx.ui.notify(enabled ? "Markus Minimal enabled" : "Built-in Pi interface restored", "info");
    },
  });

  pi.registerCommand("minimal-info", {
    description: "Show session, context, usage, and tool details",
    handler: async (_args, context) => {
      refresh(context);
      if (ctx.mode !== "tui") return;
      const s = snapshot();
      const session = ctx.sessionManager;
      await ctx.ui.select("Markus Minimal · information (Esc to close)", [
        `Pi: ${VERSION} · theme: ${ctx.ui.theme.name ?? "custom"}`,
        `Status: ${activity()}${s.queued ? " · messages queued" : ""}`,
        `Model: ${s.provider} / ${s.model}`,
        `API: ${ctx.model?.api ?? "?"} · reasoning: ${s.thinking}`,
        `Estimated context: ${Number.isFinite(s.contextTokens) ? s.contextTokens : "?"} / ${Number.isFinite(s.contextWindow) ? s.contextWindow : "?"} · ${s.percent ?? "?"}%`,
        `Output limit: ${ctx.model?.maxTokens ?? "?"} tokens`,
        `Input: ${stats.input} · output: ${stats.output}`,
        `Cache read: ${stats.cacheRead} · written: ${stats.cacheWrite}`,
        `Estimated branch cost: ${stats.costReported ? "$" + stats.cost.toFixed(6) : "unavailable"}`,
        `Responses: ${stats.responses} · completed tools: ${stats.tools} · errors: ${stats.errors}`,
        `Branch compactions: ${stats.compactions}`,
        `Session: ${session.getSessionName() ?? "unnamed"} · ${session.getSessionId()}`,
        `File: ${session.getSessionFile() ?? "ephemeral session"}`,
        `Directory: ${ctx.cwd}`,
        `Git: ${s.branch ?? "no branch / unavailable"}`,
        `Project trust: ${ctx.isProjectTrusted() ? "granted" : "not granted"}`,
        `Active tools: ${pi.getActiveTools().join(", ") || "none"}`,
        `Time open: ${duration(s.elapsed)} · last turn: ${duration(lastRun)}`,
        ...s.statuses.map(text => `Extension: ${text}`),
        "Tokens and costs cover the active branch; they are not your provider's bill.",
      ].map(clean));
    },
  });
}
