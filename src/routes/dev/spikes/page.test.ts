import { isHttpError } from '@sveltejs/kit';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rejectWith } from '../../../test/ipc.js';
import Page from './+page.svelte';
import { load } from './+page.js';

function loadError(): unknown {
  try {
    load();
  } catch (err: unknown) {
    return err;
  }
  return undefined;
}

afterEach(() => {
  vi.unstubAllEnvs();
  clearMocks();
});

describe('/dev/spikes gate', () => {
  it('is available in dev mode', () => {
    expect(loadError()).toBeUndefined();
  });

  it('is available in a spikes build (VITE_MPT_SPIKES=1)', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_MPT_SPIKES', '1');
    expect(loadError()).toBeUndefined();
  });

  it('responds with 404 in a release build', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_MPT_SPIKES', '');
    expect(isHttpError(loadError(), 404)).toBe(true);
  });
});

describe('/dev/spikes page', () => {
  function mockBackend(): void {
    mockIPC((cmd) => {
      switch (cmd) {
        case 'spike_prepare_media':
          return rejectWith({ code: 'app.internal', message: 'no data dir' });
        case 'spike_tts_voices':
          return {
            backend: 'SpeechDispatcher',
            voices: [
              { id: 'en-us', name: 'English (America)', language: 'en-US' },
              { id: 'ru', name: 'Russian', language: 'ru' },
            ],
            totalVoices: 5,
            rateMin: -100,
            rateNormal: 0,
            rateMax: 100,
          };
        case 'spike_tts_speak':
          return { voice: { id: 'ru', name: 'Russian', language: 'ru' }, backendRate: 0 };
        default:
          return rejectWith(`Command ${cmd} not found`);
      }
    });
  }

  /** Стенд загружается через `import()`: ждём первый раздел. */
  async function renderPage(): Promise<void> {
    render(Page);
    await screen.findByTestId('spike-audio-result');
  }

  it('renders all six sections with results', async () => {
    mockBackend();
    await renderPage();
    for (const id of ['audio', 'jitter', 'tts', 'pointer', 'katex', 'csp']) {
      expect(screen.getByTestId(`spike-${id}-result`)).toBeInTheDocument();
    }
    expect(
      await screen.findByText('Бэкенд SpeechDispatcher, всего голосов: 5'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('app.internal');
  });

  it('shows data-t of a clicked formula part', async () => {
    mockBackend();
    await renderPage();
    const part = document.querySelector('[data-t="t2"]');
    expect(part).not.toBeNull();
    if (part !== null) await fireEvent.click(part);
    expect(screen.getByTestId('katex-clicked')).toHaveTextContent('data-t = t2');
  });

  it('speaks Russian and shows the chosen voice', async () => {
    mockBackend();
    await renderPage();
    await fireEvent.click(screen.getByRole('button', { name: 'Сказать по-русски' }));
    expect(await screen.findByText('Голос: Russian (ru), скорость бэкенда 0')).toBeInTheDocument();
  });

  it('keeps the TTS rate slider stable across consecutive input events', async () => {
    mockBackend();
    await renderPage();
    const slider = screen.getByRole<HTMLInputElement>('slider', { name: 'Скорость' });
    const output = slider.parentElement?.querySelector('output');
    for (const value of ['1.25', '1.5', '1.75', '2', '0.75', '0.5']) {
      await fireEvent.input(slider, { target: { value } });
      // Тот же элемент (не пересоздан), значение не перезаписано округлением/форматированием.
      expect(screen.getByRole('slider', { name: 'Скорость' })).toBe(slider);
      expect(slider.value).toBe(value);
      expect(output?.textContent.trim()).toBe(`×${Number(value).toFixed(2)}`);
    }
    await fireEvent.click(screen.getByRole('button', { name: 'Сказать по-русски' }));
    expect(await screen.findByText('Голос: Russian (ru), скорость бэкенда 0')).toBeInTheDocument();
    expect(slider.value).toBe('0.5');
  });

  it('falls back to a textarea when the clipboard is unavailable', async () => {
    mockBackend();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    // В jsdom нет navigator.clipboard — как в WebView без разрешения на буфер обмена.
    expect('clipboard' in navigator).toBe(false);
    await renderPage();
    await fireEvent.click(screen.getByRole('button', { name: 'Скопировать результат в JSON' }));
    const textarea = await screen.findByRole('textbox', { name: 'Результат в JSON' });
    const report = JSON.parse((textarea as HTMLTextAreaElement).value) as Record<string, unknown>;
    expect(Object.keys(report)).toEqual(
      expect.arrayContaining([
        'userAgent',
        'generatedAt',
        'platform',
        'audio',
        'jitter',
        'tts',
        'pointer',
        'katex',
        'csp',
      ]),
    );
    vi.unstubAllGlobals();
  });
});
