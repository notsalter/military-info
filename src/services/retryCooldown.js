import { safeGet, safeSet } from './storage';

const deadlines = new Map();
function validDeadline(value) {
  const deadline = Number(value);
  return Number.isFinite(deadline) && Number.isFinite(new Date(deadline).getTime()) ? deadline : 0;
}
export function retryDeadline(value, now = Date.now()) {
  const seconds = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  const requested = Number.isFinite(seconds) && seconds >= 0 ? now + seconds * 1000 : Date.parse(value);
  return Math.max(now + 1000, Number.isFinite(new Date(requested).getTime()) ? requested : now + 60000);
}
export function cooldownActive(key, warn) {
  const stored = safeGet(key);
  if (!stored.success) warn?.(stored.error);
  const deadline = Math.max(0, validDeadline(deadlines.get(key)), validDeadline(stored.value));
  if (deadline > Date.now()) deadlines.set(key, deadline);
  else deadlines.delete(key);
  return deadline > Date.now();
}
export function setCooldown(key, retryAfter, warn) {
  const deadline = retryDeadline(retryAfter);
  const stored = safeGet(key);
  if (!stored.success) warn?.(stored.error);
  deadlines.set(key, Math.max(0, validDeadline(deadlines.get(key)), validDeadline(stored.value), validDeadline(deadline)));
  const saved = safeSet(key, String(deadlines.get(key)));
  if (!saved.success) warn?.(saved.error);
}
