import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AgentInfoResponse } from '@/types/api-helpers';

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const RANGE_PRESETS = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-2xs uppercase tracking-wider text-fg-muted">
      {children}
    </p>
  );
}

/** Numbered "what happens" list — the concrete consequence of the action. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((txt, i) => (
        <li key={i} className="flex gap-3 text-sm text-fg-secondary">
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-2xs text-fg-secondary">
            {i + 1}
          </span>
          <span className="leading-relaxed">{txt}</span>
        </li>
      ))}
    </ol>
  );
}

/** Chevron disclosure for optional settings sections. */
function Disclosure({
  label,
  hint,
  defaultExpanded,
  children,
}: {
  label: string;
  hint?: string;
  defaultExpanded: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="mt-4">
      <button
        type="button"
        className="flex items-center gap-2 text-xs font-semibold text-fg-secondary hover:text-fg"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            expanded && 'rotate-90',
          )}
        />
        {label}
        {hint && <span className="font-normal text-fg-muted">· {hint}</span>}
      </button>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}

/* ── Telegram ────────────────────────────────────────────────────────── */

export interface TelegramFieldValues {
  token: string;
  chatId: string;
  onTokenChange: (v: string) => void;
  onChatIdChange: (v: string) => void;
}

/** Bare token + chat-id inputs (no disclosure) — shared by dry-run & live. */
export function TelegramInputs({
  token,
  chatId,
  onTokenChange,
  onChatIdChange,
}: TelegramFieldValues) {
  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-2.5">
      <div className="space-y-1.5">
        <label
          htmlFor="tg-token"
          className="block text-xs font-medium text-fg-muted"
        >
          Telegram bot token
        </label>
        <Input
          id="tg-token"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder="123456:ABC-xyz"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="tg-chat"
          className="block text-xs font-medium text-fg-muted"
        >
          Telegram Chat ID
        </label>
        <Input
          id="tg-chat"
          value={chatId}
          onChange={(e) => onChatIdChange(e.target.value)}
          placeholder="e.g. 6041589302"
          autoComplete="off"
        />
      </div>
      <p className="col-span-2 text-2xs text-fg-muted">
        Fill both to override at launch; leave both empty to keep the bot's
        saved Telegram config.
      </p>
    </div>
  );
}

/** Disclosure-wrapped Telegram config. Auto-expands when a value is prefilled
 * (e.g. VITE_TELEGRAM_BOT_TOKEN) so a both-or-none validation error never
 * points at hidden fields. */
export function TelegramFields(props: TelegramFieldValues) {
  return (
    <Disclosure
      label="Telegram notifications"
      hint="optional"
      defaultExpanded={Boolean(props.token || props.chatId)}
    >
      <TelegramInputs {...props} />
    </Disclosure>
  );
}

/* ── Backtest ────────────────────────────────────────────────────────── */

export interface BacktestPanelProps {
  pair: string;
  timeframe: string;
  currency: string;
  strategyMissing: boolean;
  days: number;
  stake: string;
  wallet: string;
  onDaysChange: (d: number) => void;
  onStakeChange: (v: string) => void;
  onWalletChange: (v: string) => void;
}

export function BacktestPanel({
  pair,
  timeframe,
  currency,
  strategyMissing,
  days,
  stake,
  wallet,
  onDaysChange,
  onStakeChange,
  onWalletChange,
}: BacktestPanelProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <SectionLabel>What happens</SectionLabel>
        <Steps
          items={[
            <>
              Replays the last{' '}
              <b className="font-semibold text-fg">
                {days} day{days > 1 ? 's' : ''}
              </b>{' '}
              of{' '}
              <b className="font-semibold text-fg">
                {pair} {timeframe}
              </b>{' '}
              candles — no orders sent.
            </>,
            <>
              You get <b className="font-semibold text-fg">PnL, win rate</b> and
              the full trade list.
            </>,
          ]}
        />
        {strategyMissing && (
          <p className="mt-4 rounded-lg border border-warning/40 bg-brand-subtle p-3 text-xs text-warning">
            This bot has no strategy name from BE — the backtest may be
            rejected.
          </p>
        )}
      </div>
      <div>
        <SectionLabel>Settings</SectionLabel>
        <p className="mb-2 text-xs font-medium text-fg-muted">Time range</p>
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => onDaysChange(r.days)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs transition-colors',
                days === r.days
                  ? 'bg-brand font-semibold text-fg-inverse'
                  : 'bg-surface-hover text-fg-secondary hover:text-fg',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label
              htmlFor="bt-stake"
              className="block text-xs font-medium text-fg-muted"
            >
              Stake / trade ({currency})
            </label>
            <Input
              id="bt-stake"
              value={stake}
              inputMode="numeric"
              onChange={(e) => onStakeChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="bt-wallet"
              className="block text-xs font-medium text-fg-muted"
            >
              Sim wallet ({currency})
            </label>
            <Input
              id="bt-wallet"
              value={wallet}
              inputMode="numeric"
              onChange={(e) => onWalletChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Dry-run ─────────────────────────────────────────────────────────── */

export function DryRunPanel(telegram: TelegramFieldValues) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <SectionLabel>What happens</SectionLabel>
        <Steps
          items={[
            <>
              Bot switches to{' '}
              <b className="font-semibold text-fg">paper mode</b> — orders fill
              a simulated wallet, no real funds.
            </>,
            <>
              Runs on live Hyperliquid prices{' '}
              <b className="font-semibold text-fg">until you stop it</b>.
            </>,
          ]}
        />
      </div>
      <div>
        <SectionLabel>Settings</SectionLabel>
        <p className="text-xs text-fg-secondary">Nothing required.</p>
        <TelegramFields {...telegram} />
      </div>
    </div>
  );
}

/* ── Live ────────────────────────────────────────────────────────────── */

function CheckItem({
  tone,
  title,
  children,
}: {
  tone: 'ok' | 'warn' | 'fail' | 'loading';
  title: string;
  children: React.ReactNode;
}) {
  // h-[18px]: the project Tailwind config has no 4.5 spacing step
  const icon =
    tone === 'ok' ? (
      <CheckCircle2 className="h-[18px] w-[18px] text-bullish" />
    ) : tone === 'warn' ? (
      <AlertTriangle className="h-[18px] w-[18px] text-brand" />
    ) : tone === 'fail' ? (
      <XCircle className="h-[18px] w-[18px] text-bearish" />
    ) : (
      <Loader2 className="h-[18px] w-[18px] animate-spin text-fg-muted" />
    );
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-surface/50 p-3">
      <span className="mt-0.5 flex-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <div className="mt-0.5 text-xs leading-relaxed text-fg-muted">
          {children}
        </div>
      </div>
    </div>
  );
}

export interface LivePanelProps extends TelegramFieldValues {
  agent: AgentInfoResponse | null;
  agentLoading: boolean;
  stakeAmount: number | null;
  currency: string;
  apiWalletAddress: string;
  onApiWalletAddressChange: (v: string) => void;
  ack: boolean;
  onAckChange: (v: boolean) => void;
  onManageAgents: () => void;
}

export function LivePanel({
  agent,
  agentLoading,
  stakeAmount,
  currency,
  apiWalletAddress,
  onApiWalletAddressChange,
  token,
  chatId,
  onTokenChange,
  onChatIdChange,
  ack,
  onAckChange,
  onManageAgents,
}: LivePanelProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <SectionLabel>Pre-flight checks</SectionLabel>
        <div className="space-y-2.5">
          {agentLoading ? (
            <CheckItem tone="loading" title="Agent wallet">
              Checking the active agent…
            </CheckItem>
          ) : agent ? (
            <CheckItem tone="ok" title="Agent wallet">
              Active agent{' '}
              <span className="font-mono text-fg-secondary">
                {shortAddress(agent.agent_address)}
              </span>
              {agent.label ? <> · {agent.label}</> : null}
              <button
                type="button"
                onClick={onManageAgents}
                className="mt-1.5 block text-2xs font-semibold text-brand hover:underline"
              >
                Manage agents →
              </button>
            </CheckItem>
          ) : (
            <CheckItem tone="fail" title="Agent wallet">
              No active agent — <b className="text-fg">Go Live</b> opens agent
              onboarding first, then continues.
            </CheckItem>
          )}
          <CheckItem tone="warn" title="USDC on Hyperliquid perps">
            {stakeAmount != null ? (
              <>
                Stakes{' '}
                <b className="font-semibold text-fg">
                  {stakeAmount} {currency}
                </b>{' '}
                per trade — fund your account first, this is{' '}
                <b className="font-semibold text-fg">not</b> checked
                automatically.
              </>
            ) : (
              <>
                Fund your perps account before starting — this is{' '}
                <b className="font-semibold text-fg">not</b> checked
                automatically.
              </>
            )}
          </CheckItem>
        </div>
      </div>
      <div>
        <SectionLabel>Settings</SectionLabel>
        <Disclosure
          label="Optional settings"
          hint="API wallet check, Telegram"
          defaultExpanded={Boolean(apiWalletAddress || token || chatId)}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="api-wallet-address"
                className="block text-xs font-medium text-fg-muted"
              >
                API wallet address
              </label>
              <Input
                id="api-wallet-address"
                value={apiWalletAddress}
                onChange={(e) => onApiWalletAddressChange(e.target.value)}
                placeholder="0x..."
                autoComplete="off"
              />
              <p className="text-2xs text-fg-muted">
                If filled, launch is blocked unless it matches the active agent.
              </p>
            </div>
            <TelegramInputs
              token={token}
              chatId={chatId}
              onTokenChange={onTokenChange}
              onChatIdChange={onChatIdChange}
            />
          </div>
        </Disclosure>
        <div className="mt-4 rounded-xl border border-bearish/40 bg-bearish-subtle p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-bearish">
            <AlertTriangle className="h-4 w-4" /> Real money
          </p>
          <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
            Real orders with your USDC until you stop it. Losses are real.
          </p>
          <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => onAckChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-bearish"
            />
            <span className="text-xs text-fg">
              I understand this bot trades{' '}
              <b className="font-semibold">real funds</b>.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
