import {
  isCurrent,
  sleep,
  startScript,
  typewriterMessage,
} from './script-runner';
import { strings } from '@/i18n/en';

/**
 * Runs the one-way Cypheus intro on first mount with an empty chat.
 * Three bubbles: hello, pitch, coming-soon. No interaction follows —
 * the panel has no input, the chat is purely informational until real
 * AI ships (see docs/superpowers/specs/2026-05-12-cypheus-coming-soon-redesign-design.md).
 */
export async function runGreeting(): Promise<void> {
  const ctx = startScript();

  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  await typewriterMessage(strings.cypheus.greeting.hello, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);

  await typewriterMessage(strings.cypheus.greeting.pitch, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);

  await typewriterMessage(strings.cypheus.greeting.comingSoon, ctx);
}
