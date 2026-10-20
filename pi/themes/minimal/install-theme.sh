#!/usr/bin/env bash
# Save the local package and default theme for future sessions.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1 || ! command -v pi >/dev/null 2>&1; then
  printf 'Error: Pi and Node.js must be available on your PATH.\n' >&2
  exit 127
fi

node --input-type=module - "$SCRIPT_DIR" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const source = process.argv[2];
const directory = path.resolve(process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent'));
const file = path.join(directory, 'settings.json');
fs.mkdirSync(directory, { recursive: true });
const exists = fs.existsSync(file);
const settings = exists ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
  throw new Error('settings.json must contain a JSON object; no changes were made.');
}
if (settings.packages !== undefined && !Array.isArray(settings.packages)) {
  throw new Error('packages must be an array; settings were not changed.');
}
const packages = settings.packages ?? [];
// Preserve existing package declarations and their filters.
const existing = packages.find(item => (typeof item === 'string' ? item : item?.source) === source);
if (existing && typeof existing !== 'string') {
  throw new Error('This package already has custom filters. Enable it through pi config to preserve them.');
}
if (!existing) packages.push(source);
settings.packages = packages;
settings.theme = 'markus-minimal';
const suffix = crypto.randomUUID();
if (exists) {
  const backup = `${file}.backup-${suffix}`;
  fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backup, 0o600);
  console.log(`Backup: ${backup}`);
}
const temporary = `${file}.tmp-${suffix}`;
try {
  fs.writeFileSync(temporary, JSON.stringify(settings, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  fs.renameSync(temporary, file);
} finally {
  if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
}
console.log(`Default theme saved to: ${file}`);
console.log('Open Pi normally, or run /reload in an existing session.');
console.log('Do not move this folder: Pi loads the package from this location.');
if (fs.existsSync(path.join(directory, 'extensions', 'minimal-ui.ts'))) {
  console.log('Warning: disable minimal-ui.ts through pi config if it overrides this interface.');
}
NODE
