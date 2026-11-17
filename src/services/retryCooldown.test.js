import { expect, it, vi } from 'vitest';
import { retryDeadline } from './retryCooldown';
import './testStorage';

it('accepts numeric Retry-After header values as seconds', () => {
  expect(retryDeadline(120, Date.parse('2026-11-17T00:00:00Z'))).toBe(Date.parse('2026-11-17T00:02:00Z'));
});

it.each([1e300, Number.MAX_VALUE, Infinity, 'Infinity'])('uses the existing fallback for unrepresentable Retry-After fixture %j', value => {
  const now = Date.parse('2026-11-17T00:00:00Z');
  expect(retryDeadline(value, now)).toBe(now + 60000);
});

it.each([
  ['numeric', 60],
  ['HTTP-date', 'Tue, 17 Nov 2026 00:01:00 GMT'],
])('preserves a longer persisted cooldown when setting a shorter %s Retry-After', async (_, retryAfter) => {
  vi.resetModules();
  const { setCooldown, cooldownActive } = await import('./retryCooldown');
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const key = 'military_info_provider_retry_after_fixture';
    const deadline = Date.parse('2026-11-17T00:02:00Z');
    localStorage.setItem(key, String(deadline));
    setCooldown(key, retryAfter);
    expect(localStorage.getItem(key)).toBe(String(deadline));
    localStorage.getItem = () => { throw new Error('blocked fixture'); };
    vi.setSystemTime(new Date('2026-11-17T00:01:59Z'));
    expect(cooldownActive(key)).toBe(true);
    vi.setSystemTime(new Date('2026-11-17T00:02:00Z'));
    expect(cooldownActive(key)).toBe(false);
  } finally { vi.useRealTimers(); }
});

it('keeps the longest memory persisted or newly requested cooldown', async () => {
  vi.resetModules();
  const { setCooldown } = await import('./retryCooldown');
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const key = 'military_info_provider_retry_after_fixture';
    setCooldown(key, 180);
    localStorage.setItem(key, String(Date.parse('2026-11-17T00:02:00Z')));
    setCooldown(key, 60);
    expect(localStorage.getItem(key)).toBe(String(Date.parse('2026-11-17T00:03:00Z')));
    setCooldown(key, 240);
    expect(localStorage.getItem(key)).toBe(String(Date.parse('2026-11-17T00:04:00Z')));
  } finally { vi.useRealTimers(); }
});

it.each(['Infinity', 'NaN', 'not-a-deadline', '', '0', '1794873599000'])('ignores invalid or expired persisted cooldown %j when setting a deadline', async value => {
  vi.resetModules();
  const { setCooldown } = await import('./retryCooldown');
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const key = 'military_info_provider_retry_after_fixture';
    localStorage.setItem(key, value);
    setCooldown(key, 60);
    expect(localStorage.getItem(key)).toBe(String(Date.parse('2026-11-17T00:01:00Z')));
  } finally { vi.useRealTimers(); }
});

it.each(['Infinity', '-Infinity', 'NaN', 'not-a-deadline', '', '0', '-1', '1794873599000', '1e300', '8640000000000001'])('does not mirror invalid persisted deadline fixture %j before a valid setter', async value => {
  vi.resetModules();
  const { setCooldown, cooldownActive } = await import('./retryCooldown');
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const key = 'military_info_provider_retry_after_fixture';
    localStorage.setItem(key, value);
    expect(cooldownActive(key)).toBe(false);
    setCooldown(key, 60);
    expect(localStorage.getItem(key)).toBe(String(Date.parse('2026-11-17T00:01:00Z')));
    localStorage.removeItem(key);
    vi.setSystemTime(new Date('2026-11-17T00:00:59Z'));
    expect(cooldownActive(key)).toBe(true);
    localStorage.getItem = () => { throw new Error('blocked fixture'); };
    const warn = vi.fn();
    vi.setSystemTime(new Date('2026-11-17T00:01:00Z'));
    expect(cooldownActive(key, warn)).toBe(false);
    expect(warn).toHaveBeenCalledWith('Unable to read browser storage.');
  } finally { vi.useRealTimers(); }
});

it.each(['Infinity', 'NaN', '1e300', '8640000000000001'])('does not retain invalid read-only deadline fixture %j after removal or blocked reads', async value => {
  vi.resetModules();
  const { cooldownActive } = await import('./retryCooldown');
  const key = 'military_info_provider_retry_after_fixture';
  localStorage.setItem(key, value);
  expect(cooldownActive(key)).toBe(false);
  localStorage.removeItem(key);
  expect(cooldownActive(key)).toBe(false);
  localStorage.getItem = () => { throw new Error('blocked fixture'); };
  const warn = vi.fn();
  expect(cooldownActive(key, warn)).toBe(false);
  expect(warn).toHaveBeenCalledWith('Unable to read browser storage.');
});

it('preserves the longest validated read deadline through invalid storage replacement and expiry', async () => {
  vi.resetModules();
  const { setCooldown, cooldownActive } = await import('./retryCooldown');
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const key = 'military_info_provider_retry_after_fixture';
    const deadline = Date.parse('2026-11-17T00:03:00Z');
    setCooldown(key, 60);
    localStorage.setItem(key, String(deadline));
    expect(cooldownActive(key)).toBe(true);
    localStorage.setItem(key, 'Infinity');
    expect(cooldownActive(key)).toBe(true);
    setCooldown(key, 120);
    expect(localStorage.getItem(key)).toBe(String(deadline));
    localStorage.removeItem(key);
    vi.setSystemTime(new Date('2026-11-17T00:02:59Z'));
    expect(cooldownActive(key)).toBe(true);
    localStorage.getItem = () => { throw new Error('blocked fixture'); };
    vi.setSystemTime(new Date('2026-11-17T00:03:00Z'));
    expect(cooldownActive(key)).toBe(false);
  } finally { vi.useRealTimers(); }
});

it('accepts a valid deadline at the JavaScript Date boundary without a policy duration cap', async () => {
  vi.resetModules();
  const { setCooldown, cooldownActive } = await import('./retryCooldown');
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const key = 'military_info_provider_retry_after_fixture';
    const deadline = 8640000000000000;
    localStorage.setItem(key, String(deadline));
    expect(cooldownActive(key)).toBe(true);
    setCooldown(key, 60);
    expect(localStorage.getItem(key)).toBe(String(deadline));
    localStorage.removeItem(key);
    vi.setSystemTime(new Date(deadline - 1));
    expect(cooldownActive(key)).toBe(true);
    vi.setSystemTime(new Date(deadline));
    expect(cooldownActive(key)).toBe(false);
  } finally { vi.useRealTimers(); }
});

it('retains a requested cooldown in memory with read and write failure warnings', async () => {
  vi.resetModules();
  const { setCooldown, cooldownActive } = await import('./retryCooldown');
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const key = 'military_info_provider_retry_after_fixture';
    localStorage.getItem = () => { throw new Error('blocked fixture'); };
    localStorage.setItem = () => { throw new Error('quota fixture'); };
    const warn = vi.fn();
    setCooldown(key, 60, warn);
    expect(warn.mock.calls.map(([error]) => error)).toEqual(['Unable to read browser storage.', 'Unable to save browser storage.']);
    vi.setSystemTime(new Date('2026-11-17T00:00:59Z'));
    expect(cooldownActive(key, warn)).toBe(true);
    vi.setSystemTime(new Date('2026-11-17T00:01:00Z'));
    expect(cooldownActive(key, warn)).toBe(false);
  } finally { vi.useRealTimers(); }
});
