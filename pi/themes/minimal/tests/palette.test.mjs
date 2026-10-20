import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const theme = JSON.parse(await readFile(new URL('../themes/markus-minimal.json', import.meta.url), 'utf8'));
function resolve(value) {
  const seen = new Set();
  while (!value.startsWith('#')) {
    assert.ok(!seen.has(value), `Circular color: ${value}`);
    seen.add(value);
    assert.ok(Object.hasOwn(theme.vars, value), `Unknown color: ${value}`);
    value = theme.vars[value];
  }
  return value;
}
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(resolve(a)), y = luminance(resolve(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('preserves the user-approved original palette', () => {
  const pinned = {canvas:'#111613',text:'#EDF0ED',blue:'#B4D8CD',surface:'#202A24',
    prompt:'#293B32',tool:'#19211D',amber:'#E7C58F',red:'#F0AAA4'};
  for (const [role,value] of Object.entries(pinned)) assert.equal(theme.vars[role],value,role);
  assert.equal(theme.colors.accent,'blue');
});

test('all theme roles resolve to explicit colors', () => {
  for (const value of Object.values(theme.colors)) assert.match(resolve(value), /^#[0-9a-f]{6}$/i);
});

test('conversation, reasoning, tools, and secondary labels remain readable', () => {
  const pairs = [
    ['text', 'canvas'], ['muted', 'canvas'], ['dim', 'canvas'],
    ['thinkingText', 'canvas'], ['userMessageText', 'userMessageBg'],
    ['customMessageText', 'customMessageBg'], ['text', 'selectedBg'],
    ['searchMatchText', 'searchMatchBg'],
  ];
  for (const bg of ['toolPendingBg', 'toolSuccessBg', 'toolErrorBg']) {
    for (const fg of ['toolTitle', 'toolOutput', 'dim', 'warning', 'error', 'success']) pairs.push([fg, bg]);
  }
  for (const [fg, bg] of pairs) {
    const ratio = contrast(theme.colors[fg] ?? fg, theme.colors[bg] ?? bg);
    assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}:1`);
  }
});

test('message and tool surfaces have distinct hierarchy on the reference canvas', () => {
  const color = role => resolve(theme.colors[role]);
  const surfaces = ['userMessageBg', 'toolSuccessBg', 'toolPendingBg', 'toolErrorBg', 'selectedBg'];
  assert.equal(new Set(surfaces.map(color)).size, surfaces.length);
  assert.ok(contrast(color('userMessageBg'), 'canvas') >= 1.5);
  assert.ok(luminance(color('userMessageBg')) > luminance(color('toolSuccessBg')));
  assert.ok(contrast(theme.colors.border, 'canvas') >= 3);
  assert.notEqual(color('thinkingText'), color('text'));
  assert.notEqual(color('mdLink'), color('mdHeading'));
  assert.notEqual(color('syntaxKeyword'), color('syntaxFunction'));
});
