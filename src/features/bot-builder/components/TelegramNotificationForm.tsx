import { Send } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { useBuilderStore } from '../store/builder.store';
import { strings } from '@/i18n/en';

const t = strings.notifications;

/**
 * Telegram notification opt-in for the Strategy phase. Ticking the toggle
 * + filling token/chat ID makes the serializer ship a populated `telegram`
 * block in the `/bot-strategy/create` payload (otherwise it stays `null`).
 *
 * Token is masked (`type="password"`) in the form, but note it WILL appear
 * in the JSON preview/copy — acceptable for the test-flow bot tokens this
 * targets. The "Create bot" button is gated by the validator when the
 * toggle is on but creds are missing (see validator.ts), so a crashing
 * empty-token payload can never be produced.
 */
export function TelegramNotificationForm() {
  const notifications = useBuilderStore((s) => s.notifications);
  const setNotifications = useBuilderStore((s) => s.setNotifications);

  const { telegramEnabled, token, chatId } = notifications;
  const missingCreds = telegramEnabled && (!token.trim() || !chatId.trim());

  return (
    <div className="space-y-5">
      <FormField
        label={
          <span className="inline-flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
            {t.telegramToggle}
          </span>
        }
        help={t.telegramHelp}
        trailing={
          <Switch
            checked={telegramEnabled}
            onCheckedChange={(v) => setNotifications({ telegramEnabled: v })}
            aria-label={t.telegramToggle}
          />
        }
      >
        {telegramEnabled ? (
          <div className="space-y-3 pt-1">
            <Input
              type="password"
              autoComplete="off"
              value={token}
              placeholder={t.tokenPlaceholder}
              aria-label={t.tokenLabel}
              onChange={(e) => setNotifications({ token: e.target.value })}
            />
            <Input
              type="text"
              inputMode="numeric"
              value={chatId}
              placeholder={t.chatIdPlaceholder}
              aria-label={t.chatIdLabel}
              onChange={(e) => setNotifications({ chatId: e.target.value })}
            />
            {missingCreds ? (
              <p className="text-xs text-danger">{t.required}</p>
            ) : null}
          </div>
        ) : null}
      </FormField>
    </div>
  );
}
