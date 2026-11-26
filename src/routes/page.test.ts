import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { changeLocale, syncDocumentLocale } from '#lib/i18n/locale.js';
import { baseLocale, getLocale } from '#lib/paraglide/runtime.js';
import Page from './+page.svelte';

describe('start page localisation', () => {
  afterEach(async () => {
    await changeLocale(baseLocale, { reload: false });
    localStorage.clear();
  });

  it('uses Russian by default', () => {
    localStorage.clear();
    syncDocumentLocale();
    expect(getLocale()).toBe('ru');
    render(Page);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Мой личный репетитор');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('switches app_title between ru and en', async () => {
    await changeLocale('en', { reload: false });
    const en = render(Page);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Personal Tutor');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('mpt.locale')).toBe('en');
    en.unmount();

    await changeLocale('ru', { reload: false });
    render(Page);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Мой личный репетитор');
    expect(document.documentElement.lang).toBe('ru');
  });
});
