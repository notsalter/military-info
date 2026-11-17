import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('environment variants are ignored while the documented example remains publishable', () => {
  for (const path of ['.env', '.env.local', '.env.production', '.env.development', '.env.staging', '.env.test']) {
    assert.equal(spawnSync('git', ['check-ignore', '--no-index', path], { cwd: root }).status, 0, `${path} must be ignored`);
  }
  assert.equal(spawnSync('git', ['check-ignore', '--no-index', '.env.example'], { cwd: root }).status, 1);
});

const root = resolve(import.meta.dirname, '..');

test('development tree excludes the hostile editor task and disguised font', () => {
  for (const path of ['.vscode/tasks.json', 'public/fonts/fa-solid-400.woff2']) {
    assert.equal(existsSync(resolve(root, path)), false, `Unsafe artifact remains: ${path}`);
  }
});

test('hostile workflow files are absent from the development tree', () => {
  for (const name of ['audit.yml', 'code-review.yml', 'security-audit.yml']) {
    assert.equal(existsSync(resolve(root, '.github/workflows', name)), false, `Unsafe workflow remains: ${name}`);
  }
});

test('workflow definitions contain no credential transfer or command download patterns', () => {
  const directory = resolve(root, '.github/workflows');
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory)) {
    const text = readFileSync(resolve(directory, name), 'utf8');
    assert.doesNotMatch(text, /193\.32\.204\.199|git log -p|--data-binary|api\.github\.com\/gists|curl[^\n]*\|\s*bash|x-access-token:/i);
  }
});
