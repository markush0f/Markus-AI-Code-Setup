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

export function headerRows(s, width, { fg, fit, measure }) {
  if (width <= 0) return [];
  const inset = width >= 24 ? 1 : 0;
  const available = width - inset * 2;
  const title = fg("accent", "PI") + "  " + fg("text", clean(s.path));
  const branch = s.branch ? fg("dim", "branch ") + fg("muted", clean(s.branch)) : "";
  const prefix = " ".repeat(inset);
  if (!branch) return [prefix + fit(title, available)];
  if (available < 40) return [prefix + fit(title, available), prefix + fit(branch, available)];
  const right = fit(branch, Math.floor(available / 2));
  const left = fit(title, available - measure(right) - 2);
  return [prefix + left + " ".repeat(available - measure(left) - measure(right)) + right];
}

export function footerRows(s, width, { fg, fit, measure }) {
  if (width <= 0) return [];
  const inset = width >= 24 ? 1 : 0;
  const available = width - inset * 2;
  const sep = "  ";
  const percent = Number.isFinite(s.percent) ? s.percent : null;
  const contextTone = percent >= 90 ? "error" : percent >= 75 ? "warning" : "text";
  const cells = [
    { label: "STATE", parts: [fg(s.busy ? "accent" : "muted", clean(s.activity)),
      ...(s.queued ? [fg("warning", "QUEUED")] : [])] },
    { label: "MODEL / REASONING", parts: [fg("accent", clean(s.model)), fg("accent", `/ ${clean(s.thinking)}`)] },
    { label: "SESSION", parts: [fg("muted", `tools ${s.stats.tools}`),
      fg(s.stats.errors ? "error" : "dim", `err ${s.stats.errors}`), fg("muted", duration(s.elapsed))] },
    { label: "TOKENS", parts: [fg("muted", `in ${number(s.stats.input)}`), fg("muted", `out ${number(s.stats.output)}`)] },
    { label: "CONTEXT", parts: [fg(contextTone, `${percent == null ? "?" : percent.toFixed(1) + "%"}`),
      fg("muted", `${number(s.contextTokens)}/${number(s.contextWindow)}`)] },
    { label: "COST / EST.", parts: [fg("text", s.stats.costReported ? `$${s.stats.cost.toFixed(4)}` : "?")] },
  ];
  const rows = [];
  const push = (line) => {
    const clipped = fit(line, available);
    rows.push(" ".repeat(inset) + clipped + " ".repeat(Math.max(0, width - inset - measure(clipped))));
  };
  const wrap = (parts, size) => {
    const result = [];
    let line = "";
    for (const item of parts) {
      const next = line ? line + " " + item : item;
      if (line && measure(next) > size) { result.push(fit(line, size)); line = item; }
      else line = next;
    }
    if (line) result.push(fit(line, size));
    return result;
  };
  const labelledParts = cell => [fg("dim", `${cell.label}:`), ...cell.parts];
  const statuses = (s.statuses ?? []).map(item => typeof item === "string"
    ? { text: item, center: false } : item);
  const visible = statuses.map(item => ({ ...item, text: clean(item.text) }))
    .filter(item => item.text.trim() && !/langfuse/i.test(item.text));
  const mcpCells = visible.filter(item => item.center).map(item => ({ label: "MCP",
    parts: [fg("muted", item.text.trim().replace(/^MCP\b\s*:?\s*/i, ""))].filter(Boolean) }));
  const grok = s.grokQuota !== undefined;
  const quota = grok ? s.grokQuota : s.codexQuota;
  const quotaLabel = grok ? `GROK / ${quota?.period === "week" ? "WEEK" : quota?.period === "month" ? "MONTH" : "QUOTA"}` : "CODEX / 5H";
  const remaining = Number.isFinite(quota?.remainingPercent) ? quota.remainingPercent : null;
  const quotaTone = remaining == null ? "muted" : remaining <= 10 ? "error" : remaining <= 25 ? "warning" : "muted";
  const resetMs = Number.isFinite(quota?.resetAt) ? Math.max(0, quota.resetAt - (s.now ?? Date.now())) : null;
  const resetTime = resetMs >= 86_400_000 ? `${Math.floor(resetMs / 86_400_000)}d ${Math.floor(resetMs % 86_400_000 / 3_600_000)}h` : duration(resetMs ?? 0);
  const quotaCell = grok || s.codexQuota !== undefined ? { label: quotaLabel, parts: [
    fg(quotaTone, remaining == null ? "?" : `${Number(remaining.toFixed(1))}% left`),
    ...(resetMs != null ? [fg("dim", `· resets in ${resetTime}`)] : []),
  ] } : null;
  if (s.queued) {
    // Pi owns pending-message text. Pack labelled telemetry into available rows.
    renderGroup([...cells, ...(quotaCell ? [quotaCell] : [])].flatMap(cell => wrap(labelledParts(cell), available)));
  } else if (width >= 100) {
    const usable = available - 4;
    const sizes = [Math.floor(usable * .26), Math.floor(usable * .40)];
    sizes.push(usable - sizes[0] - sizes[1]);
    const columnRow = values => values.map((value, i) => value + " ".repeat(Math.max(0, sizes[i] - measure(value)))).join(sep);
    const renderColumns = group => {
      const lines = group.map((cell, i) => cell ? wrap(labelledParts(cell), sizes[i]) : []);
      for (let row = 0; row < Math.max(...lines.map(value => value.length)); row++) {
        push(columnRow(lines.map(value => value[row] ?? "")));
      }
    };
    for (let start = 0; start < cells.length; start += 3) renderColumns(cells.slice(start, start + 3));
    if (mcpCells.length || quotaCell) renderColumns([mcpCells.shift(), quotaCell, null]);
  } else {
    // Below the table breakpoint labels travel with their values, never alone.
    for (const cell of cells) {
      for (const line of wrap(labelledParts(cell), available)) push(line);
      if (cell.label === "CONTEXT" && quotaCell) {
        for (const line of wrap(labelledParts(quotaCell), available)) push(line);
      }
    }
  }
  function renderGroup(group) {
    let line = "";
    for (const item of group) {
      const next = line ? line + sep + item : item;
      if (line && measure(next) > available) { push(line); line = item; }
      else line = next;
    }
    if (line) push(line);
  }
  for (const cell of mcpCells) {
    for (const line of wrap(labelledParts(cell), available)) push(line);
  }
  renderGroup(visible.filter(item => !item.center).map(item => fg("muted", item.text)));
  return rows;
}
