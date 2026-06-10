import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TelegramNotificationForm } from './TelegramNotificationForm';
import { useBuilderStore } from '../store/builder.store';
import { strings } from '@/i18n/en';

const t = strings.notifications;

describe('TelegramNotificationForm', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('hides the token + chat ID inputs until the toggle is on', () => {
    render(<TelegramNotificationForm />);
    expect(
      screen.queryByPlaceholderText(t.tokenPlaceholder),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(t.chatIdPlaceholder),
    ).not.toBeInTheDocument();
  });

  it('toggling on reveals masked token + chat ID inputs and sets state', () => {
    render(<TelegramNotificationForm />);
    fireEvent.click(screen.getByRole('switch'));

    expect(useBuilderStore.getState().notifications.telegramEnabled).toBe(true);

    const token = screen.getByPlaceholderText(t.tokenPlaceholder);
    const chatId = screen.getByPlaceholderText(t.chatIdPlaceholder);
    // Token is sensitive → masked input.
    expect(token).toHaveAttribute('type', 'password');
    expect(chatId).toBeInTheDocument();
  });

  it('typing updates notifications in the store', () => {
    useBuilderStore.getState().setNotifications({ telegramEnabled: true });
    render(<TelegramNotificationForm />);

    fireEvent.change(screen.getByPlaceholderText(t.tokenPlaceholder), {
      target: { value: '123:ABC' },
    });
    fireEvent.change(screen.getByPlaceholderText(t.chatIdPlaceholder), {
      target: { value: '987654321' },
    });

    const { notifications } = useBuilderStore.getState();
    expect(notifications.token).toBe('123:ABC');
    expect(notifications.chatId).toBe('987654321');
  });

  it('warns when enabled but creds are missing', () => {
    useBuilderStore.getState().setNotifications({ telegramEnabled: true });
    render(<TelegramNotificationForm />);
    expect(screen.getByText(t.required)).toBeInTheDocument();
  });
});
