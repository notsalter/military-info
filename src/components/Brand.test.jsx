import { beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { clear: vi.fn() } }));
import { readFileSync } from 'node:fs';
import { cwd } from 'node:process';
const stylesheet = readFileSync(`${cwd()}/src/index.css`, 'utf8');

it('preserves readable text on pressed control surfaces', () => {
  expect(stylesheet).toMatch(/button:active, a:active\s*\{[^}]*color: var\(--bone\)/);
});

it('uses the authored matte brand tokens, mobile reflow and visible native control focus', () => {
  for (const color of ['#0b0d0c', '#e9e6db', '#a6aaa2', '#d4bc89', '#414740']) expect(stylesheet).toContain(color);
  expect(stylesheet).not.toMatch(/fonts\.googleapis|backdrop-filter|@keyframes|linear-gradient/);
  expect(stylesheet).toContain(':focus-visible');
  expect(stylesheet).toContain('min-height: 44px');
  expect(stylesheet).toContain('min-width: 0');
  expect(stylesheet).toContain('prefers-reduced-motion');
  expect(stylesheet).toMatch(/@media \(min-width: 44rem\)/);
  expect(stylesheet).toMatch(/@media \(min-width: 70rem\)/);
});
