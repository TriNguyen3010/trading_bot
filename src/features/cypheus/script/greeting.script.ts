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

  // Stay on 'hello' so the avatar keeps looping while the user reads the
  // greeting. The magic-build script flips it to 'coding' on first
  // interaction, and CreateNewBotButton resets back to 'hello' when the
  // user starts over.
  useCypheusStore.getState().setState('idle');
}
