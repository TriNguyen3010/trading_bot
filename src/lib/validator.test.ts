import { describe, expect, it, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { validateBuilder } from './validator';
import { strings } from '@/i18n/en';

/**
 * Guard against the bug that returned a 500 on deploy: a USDC-quoted pair
 * (e.g. Hyperliquid's BTC/USDC:USDC) staked in USDT. Freqtrade funds the
 * wallet in `stake_currency`, so a USDT wallet can't trade a USDC pair —
 * BE raised an unhandled exception → 500. We block it at the FE instead.
 */
describe('validateBuilder — stake currency vs pair quote', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('flags a stake currency that does not match the pair quote', () => {
    const b = useBuilderStore.getState();
    b.patchBotConfig({ pair: 'BTC-USDC', stakeCurrency: 'USDT' });

    const issues = validateBuilder(useBuilderStore.getState());

    expect(issues).toContainEqual(
      expect.objectContaining({
        stepId: 'bot-config',
        message: expect.stringContaining('match the pair quote'),
      }),
    );
  });

  it('does not flag when stake currency matches the pair quote', () => {
    const b = useBuilderStore.getState();
    b.patchBotConfig({ pair: 'BTC-USDC', stakeCurrency: 'USDC' });

    const issues = validateBuilder(useBuilderStore.getState());

    expect(
      issues.filter((i) => i.message.includes('match the pair quote')),
    ).toHaveLength(0);
  });

  it('does not add a quote-mismatch issue when the pair is malformed', () => {
    const b = useBuilderStore.getState();
    // No quote to compare against — the existing pair-format rule owns this.
    b.patchBotConfig({ pair: 'BTC', stakeCurrency: 'USDT' });

    const issues = validateBuilder(useBuilderStore.getState());

    expect(
      issues.filter((i) => i.message.includes('match the pair quote')),
    ).toHaveLength(0);
  });
});

describe('validateBuilder — telegram notifications', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  const requiredMsg = strings.notifications.requiredIssue;

  it('flags an enabled telegram tick with a missing token', () => {
    useBuilderStore
      .getState()
      .setNotifications({ telegramEnabled: true, token: '', chatId: '123' });

    const issues = validateBuilder(useBuilderStore.getState());

    expect(issues).toContainEqual(
      expect.objectContaining({ message: requiredMsg }),
    );
  });

  it('flags an enabled telegram tick with a missing chat ID', () => {
    useBuilderStore
      .getState()
      .setNotifications({ telegramEnabled: true, token: 'T', chatId: '  ' });

    const issues = validateBuilder(useBuilderStore.getState());

    expect(issues).toContainEqual(
      expect.objectContaining({ message: requiredMsg }),
    );
  });

  it('does not flag when telegram is off', () => {
    useBuilderStore
      .getState()
      .setNotifications({ telegramEnabled: false, token: '', chatId: '' });

    const issues = validateBuilder(useBuilderStore.getState());

    expect(issues.filter((i) => i.message === requiredMsg)).toHaveLength(0);
  });

  it('does not flag when telegram is on with both creds', () => {
    useBuilderStore
      .getState()
      .setNotifications({ telegramEnabled: true, token: 'T', chatId: '123' });

    const issues = validateBuilder(useBuilderStore.getState());

    expect(issues.filter((i) => i.message === requiredMsg)).toHaveLength(0);
  });
});
