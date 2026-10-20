import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));

test('installer copies runtime resources into Pi and migrates repository references', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'minimal-install-'));
  try {
    const source = path.join(temporary, 'source');
    const agent = path.join(temporary, 'agent');
    const bin = path.join(temporary, 'bin');
    fs.mkdirSync(source);
    fs.mkdirSync(agent);
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'pi'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    for (const resource of ['install-theme.sh', 'package.json', 'extensions', 'themes']) {
      fs.cpSync(path.join(root, resource), path.join(source, resource), { recursive: true });
    }
    const settingsFile = path.join(agent, 'settings.json');
    const original = { model: 'keep-me', packages: ['npm:unrelated', {
      source, extensions: ['extensions/index.ts'], themes: [],
    }] };
    fs.writeFileSync(settingsFile, JSON.stringify(original));
    const run = script => {
      const result = spawnSync('bash', [script], {
        env: { ...process.env, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:${process.env.PATH}` },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
    };
    run(path.join(source, 'install-theme.sh'));
    const destination = path.join(agent, 'packages', 'markus-minimal');
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    assert.deepEqual(settings, { ...original, theme: 'markus-minimal', packages: [
      'npm:unrelated', { ...original.packages[1], source: destination },
    ] });
    assert.ok(fs.readdirSync(agent).some(name => name.startsWith('settings.json.backup-')));
    for (const resource of ['package.json', 'extensions/index.ts', 'extensions/layout.mjs',
      'extensions/tool-style.ts', 'extensions/markdown-style.ts', 'themes/markus-minimal.json']) {
      assert.equal(fs.lstatSync(path.join(destination, resource)).isSymbolicLink(), false);
      assert.deepEqual(fs.readFileSync(path.join(destination, resource)), fs.readFileSync(path.join(source, resource)));
    }
    run(path.join(source, 'install-theme.sh'));
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile, 'utf8')), settings);
    fs.rmSync(source, { recursive: true });
    assert.ok(fs.readFileSync(path.join(destination, 'extensions/index.ts'), 'utf8').length);
    assert.equal(JSON.parse(fs.readFileSync(path.join(destination, 'themes/markus-minimal.json'), 'utf8')).name, 'markus-minimal');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
