// Pure presentation helpers; terminal column operations are injected by Pi.
export function clean(value) {
  return String(value ?? "").replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
}

export function number(value) {
  if (!Number.isFinite(value)) return "?";
  if (value < 1000) return String(Math.round(value));
  if (value < 1e6) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1e6).toFixed(2)}m`;
}

export function duration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
}

export function summarize(entries) {
  const stats = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0,
    costReported: false, responses: 0, tools: 0, errors: 0, compactions: 0 };
  for (const entry of entries) {
    if (entry.type === "compaction") stats.compactions++;
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role === "toolResult") {
      stats.tools++;
      if (message.isError) stats.errors++;
    }
    if (message.role !== "assistant") continue;
    stats.responses++;
    const usage = message.usage;
    for (const key of ["input", "output", "cacheRead", "cacheWrite"]) {
      if (Number.isFinite(usage?.[key])) stats[key] += usage[key];
    }
    if (Number.isFinite(usage?.cost?.total)) {
      stats.cost += usage.cost.total;
      stats.costReported = true;
    }
  }
  return stats;
}

export function footerRows(s, width, { fg, fit, measure }) {
  if (width <= 0) return [];
  const inset = width >= 24 ? 1 : 0;
  const available = width - inset * 2;
  const sep = "  ";
  const contextTone = s.percent >= 90 ? "error" : s.percent >= 75 ? "warning" : "muted";
  const context = fg(contextTone, `ctx ${s.percent == null ? "?" : s.percent.toFixed(1) + "%"} ${number(s.contextTokens)}/${number(s.contextWindow)}`);
  const money = s.stats.costReported ? `$${s.stats.cost.toFixed(4)} est.` : "cost ?";
  const state = fg(s.busy ? "accent" : "success", s.activity);
  const model = fg("text", `${clean(s.model)} / ${clean(s.thinking)}`);
  // Each row has a left reading group and a secondary right-aligned group.
  const groups = [
    [[state, model], [fg("muted", money)]],
    [[fg("muted", `in ${number(s.stats.input)} out ${number(s.stats.output)}`)], [context]],
    [[fg("muted", `${clean(s.path)}${s.branch ? " @ " + clean(s.branch) : ""}`)],
      [fg(s.stats.errors ? "warning" : "dim", `tools ${s.stats.tools} err ${s.stats.errors}`),
        fg("dim", `${duration(s.elapsed)}${s.queued ? " · queued" : ""}`)]],
  ];
  const rows = [];
  const push = (line) => rows.push(" ".repeat(inset) + fit(line, available));
  const renderGroup = (group) => {
    let line = "";
    for (const item of group) {
      const next = line ? line + sep + item : item;
      if (line && measure(next) > available) { push(line); line = item; }
      else line = next;
    }
    if (line) push(line);
  };
  groups.forEach(([left, right]) => {
    const start = left.join(sep);
    const end = right.join(sep);
    const gap = available - measure(start) - measure(end);
    if (gap >= sep.length) {
      push(start + " ".repeat(gap) + end);
    } else {
      // Stack complete groups when they cannot share a row, retaining all data.
      renderGroup(left);
      if (measure(end) <= available) push(" ".repeat(available - measure(end)) + end);
      else renderGroup(right);
    }
  });
  const statuses = (s.statuses ?? []).map(item => typeof item === "string"
    ? { text: item, center: false } : item);
  const visible = statuses.map(item => ({ ...item, text: clean(item.text) }))
    .filter(item => item.text.trim() && !/langfuse/i.test(item.text));
  renderGroup(visible.filter(item => !item.center).map(item => fg("muted", item.text)));
  for (const item of visible.filter(item => item.center)) {
    const text = fg("accent", item.text);
    const pad = Math.max(0, Math.floor((available - measure(text)) / 2));
    push(" ".repeat(pad) + text);
  }
  return rows;
}
