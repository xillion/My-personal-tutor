import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { rejectWith } from '../../test/ipc.js';
import type { AppInfoDto } from '#lib/ipc/client.js';
import Page from './+page.svelte';
import { load } from './+page.js';

const INFO: AppInfoDto = {
  version: '0.0.0',
  os: 'linux',
  arch: 'x86_64',
  dataDir: '/home/kid/.local/share/dev.rnd-center.mpt',
  coursesDir: '/home/kid/.local/share/dev.rnd-center.mpt/courses',
  builtAtMs: Date.UTC(2026, 10, 26, 12, 0, 0),
};

function mockBackend(): void {
  mockIPC((cmd, payload) => {
    switch (cmd) {
      case 'app_info':
        return INFO;
      case 'app_ping': {
        const { message } = payload as { message: string };
        if (message === '') {
          return rejectWith({ code: 'app.invalid_argument', message: 'empty message' });
        }
        return message;
      }
      default:
        return rejectWith(`Command ${cmd} not found`);
    }
  });
}

afterEach(() => {
  clearMocks();
});

describe('/dev page', () => {
  it('is available in dev mode', () => {
    expect(() => {
      load();
    }).not.toThrow();
  });

  it('shows app_info', async () => {
    mockBackend();
    render(Page);
    expect(await screen.findByText(INFO.coursesDir)).toBeInTheDocument();
    expect(screen.getByText('linux / x86_64')).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-11-26T12:00:00.000Z');
  });

  it('shows the app_ping reply after clicking Ping', async () => {
    mockBackend();
    render(Page);
    const input = screen.getByRole('textbox', { name: 'Сообщение' });
    await fireEvent.input(input, { target: { value: 'привет' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Ping' }));
    expect(await screen.findByText('Ответ: привет')).toBeInTheDocument();
  });

  it('shows a friendly message for a typed error', async () => {
    mockBackend();
    render(Page);
    await fireEvent.input(screen.getByRole('textbox', { name: 'Сообщение' }), {
      target: { value: '' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Ping' }));
    const output = screen.getByTestId('ping-output');
    await expect
      .poll(() => output.textContent)
      .toContain('Кажется, тут чего-то не хватает. Проверь и попробуй ещё раз.');
    expect(output).toHaveTextContent('app.invalid_argument');
  });
});
