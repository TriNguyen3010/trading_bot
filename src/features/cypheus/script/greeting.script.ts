import { useCypheusStore } from '../store/cypheus.store';
import {
  isCurrent,
  sleep,
  startScript,
  typewriterMessage,
} from './script-runner';
import { strings } from '@/i18n/en';

export async function runGreeting(): Promise<void> {
  const ctx = startScript();
  const cy = useCypheusStore.getState();

  cy.setState('greeting');
  cy.setAvatar('hello');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  await typewriterMessage(strings.cypheus.greeting.hello, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);
  await typewriterMessage(strings.cypheus.greeting.pitch, ctx);
  if (!isCurrent(ctx)) return;

  useCypheusStore.getState().setAvatar('idle');
  useCypheusStore.getState().setState('idle');
}
