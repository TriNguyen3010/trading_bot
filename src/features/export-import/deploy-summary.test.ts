import { describe, it, expect, beforeEach } from 'vitest';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { getDeploySummary } from './deploy-summary';

describe('getDeploySummary — telegram notifications', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('telegram is null when the tick is off', () => {
    expect(getDeploySummary(useBuilderStore.getState()).telegram).toBeNull();
  });

  it('telegram carries only the chat ID when enabled (never the token)', () => {
    useBuilderStore.getState().setNotifications({
      telegramEnabled: true,
      token: 'super-secret-token',
      chatId: '987654321',
    });
    const summary = getDeploySummary(useBuilderStore.getState());
    expect(summary.telegram).toEqual({ chatId: '987654321' });
    // The token must NOT leak into the review summary.
    expect(JSON.stringify(summary)).not.toContain('super-secret-token');
  });

  it('telegram stays null when enabled but creds are incomplete', () => {
    useBuilderStore
      .getState()
      .setNotifications({ telegramEnabled: true, token: 'T', chatId: '' });
    expect(getDeploySummary(useBuilderStore.getState()).telegram).toBeNull();
  });
});
