import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import SettingsModal from './SettingsModal';
import { saveCustomKeys, clearCustomKeys, clearCache } from '../services/newsApi';

vi.mock('../services/newsApi', () => ({ getCustomKeys: () => ({}), saveCustomKeys: vi.fn(), clearCustomKeys: vi.fn(), clearCache: vi.fn() }));
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { clear: vi.fn() } });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

function Harness() {
  const [open, setOpen] = useState(false);
  return <><div data-testid="background"><button onClick={() => setOpen(true)}>Settings</button></div>
    <SettingsModal isOpen={open} onClose={() => setOpen(false)} onConfigSaved={vi.fn()} /></>;
}

it('opens a native modal with locked focus and restores the trigger on Escape', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Settings' });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Settings' });
  expect(dialog.tagName).toBe('DIALOG');
  expect(dialog).toHaveAttribute('open');
  expect(screen.getByTestId('background').parentElement).toHaveAttribute('inert');
  expect(document.body.style.overflow).toBe('hidden');
  const buttons = within(dialog).getAllByRole('button');
  buttons.at(-1).focus();
  expect(buttons.at(-1)).toHaveFocus();
  await user.tab();
  expect(within(dialog).getByRole('button', { name: 'Close settings' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(buttons.at(-1)).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(screen.getByTestId('background').parentElement).not.toHaveAttribute('inert');
  expect(document.body.style.overflow).toBe('');
});

it('keeps optional password keys open when browser storage rejects a save', async () => {
  const user = userEvent.setup();
  const onConfigSaved = vi.fn();
  saveCustomKeys.mockReturnValue({ success: false, error: 'Storage blocked' });
  render(<SettingsModal isOpen onClose={vi.fn()} onConfigSaved={onConfigSaved} />);
  const key = screen.getByLabelText('NewsAPI key (optional)');
  expect(key).toHaveAttribute('type', 'password');
  expect(screen.getByLabelText('TheNewsAPI key (optional)')).toHaveAttribute('type', 'password');
  expect(screen.getByText(/stored in plain text/i)).toBeInTheDocument();
  await user.type(key, 'test-fixture-key');
  await user.click(screen.getByRole('button', { name: 'Save keys' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save keys');
  expect(key).toHaveValue('test-fixture-key');
  expect(onConfigSaved).not.toHaveBeenCalled();
  saveCustomKeys.mockReturnValue({ success: true });
  await user.click(screen.getByRole('button', { name: 'Save keys' }));
  expect(onConfigSaved).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('Keys saved');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('reports key removal and cache clearing failures without notifying a refresh', async () => {
  const user = userEvent.setup();
  const onConfigSaved = vi.fn();
  clearCustomKeys.mockReturnValue({ success: false });
  clearCache.mockReturnValue({ success: false });
  render(<SettingsModal isOpen onClose={vi.fn()} onConfigSaved={onConfigSaved} />);
  await user.click(screen.getByRole('button', { name: 'Remove keys' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not remove keys');
  await user.click(screen.getByRole('button', { name: 'Clear news cache' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not clear');
  expect(onConfigSaved).not.toHaveBeenCalled();
  clearCustomKeys.mockReturnValue({ success: true });
  await user.click(screen.getByRole('button', { name: 'Remove keys' }));
  expect(screen.getByRole('status')).toHaveTextContent('Keys removed');
  clearCache.mockReturnValue({ success: true });
  await user.click(screen.getByRole('button', { name: 'Clear news cache' }));
  expect(screen.getByRole('status')).toHaveTextContent('News cache cleared');
  expect(onConfigSaved).toHaveBeenCalledTimes(2);
});
