import { Markdown, truncateToWidth, visibleWidth, type MarkdownTheme } from "@earendil-works/pi-tui";

const patched = Symbol.for("markus.quietCodeFences");
const PATCH = 3;
const RESET = "\x1b[0m";
const PANEL = "\x1b[48;2;36;48;43m";
const SAGE = "\x1b[38;2;169;199;194m";
const DIM = "\x1b[38;2;140;150;144m";

type Token = { type?: string; text?: string; lang?: string };
type RenderToken = (token: Token, width: number, next?: string, style?: unknown) => string[];

function paint(content: string, width: number): string {
  const inner = Math.max(1, width - 2);
  let body = visibleWidth(content) > inner ? truncateToWidth(content, inner) : content;
  const gap = inner - visibleWidth(body);
  if (gap > 0) body += " ".repeat(gap);
  body = body.replaceAll(RESET, RESET + PANEL).replaceAll("\x1b[49m", `\x1b[49m${PANEL}`);
  return PANEL + SAGE + "│ " + RESET + PANEL + body + RESET;
}

function highlightLine(theme: MarkdownTheme, line: string, lang?: string): string {
  if (!line) return "";
  if (theme.highlightCode) return theme.highlightCode(line, lang)[0] ?? line;
  return theme.codeBlock?.(line) ?? line;
}

/** One continuous panel, including blank lines inside the code. */
export function renderCodePanel(theme: MarkdownTheme, token: Token, width: number, next?: string): string[] {
  const source = (token.text ?? "").replace(/\n$/, "").split("\n");
  const lines = source.map((line, index) => {
    let shown = highlightLine(theme, line, token.lang);
    if (index === 0 && token.lang) {
      const room = width - 2 - visibleWidth(shown) - token.lang.length - 2;
      if (room >= 1) shown += DIM + " ".repeat(room) + token.lang + RESET;
    }
    return paint(shown, width);
  });
  if (lines.length === 0) lines.push(paint("", width));
  if (next && next !== "space") lines.push("");
  return lines;
}

export function installQuietCodeFences(): void {
  const proto = Markdown.prototype as Markdown & { [patched]?: number; renderToken: RenderToken };
  if (proto[patched] === PATCH) return;
  const renderToken = proto.renderToken;
  proto.renderToken = function (this: { theme: MarkdownTheme }, token, width, next, style) {
    if (token?.type !== "code") return renderToken.call(this, token, width, next, style);
    return renderCodePanel(this.theme, token, width, next);
  };
  proto[patched] = PATCH;
}
