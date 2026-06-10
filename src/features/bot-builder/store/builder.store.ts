import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BuilderState,
  BotConfigForm,
  CloseMethodForm,
  DirectionForm,
  DrawerTab,
  EntryStrategyForm,
  NotificationForm,
  StepId,
  StepStatus,
} from '@/types/builder.types';
import { emptyConditionTree, migrateLegacyGroup } from '@/lib/condition-tree';
import { makeDefaultNames } from '@/lib/default-names';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

/** Per user request 2026-04-30: drawer is locked at this width — the
 * adjustable min/max + DrawerResizeHandle were removed. Exported so
 * StepDrawer + BuilderPage size their layout to match. */
export const FIXED_DRAWER_WIDTH = 480;
const MIN_DRAWER_WIDTH = FIXED_DRAWER_WIDTH;
const MAX_DRAWER_WIDTH = FIXED_DRAWER_WIDTH;
const DEFAULT_DRAWER_WIDTH = FIXED_DRAWER_WIDTH;

const defaultBotConfig: BotConfigForm = {
  pair: '',
  timeframe: '5m',
  leverage: 1,
  exchange: 'hyperliquid',
  marketType: 'futures',
  marginMode: 'cross',
  maxOpenTrades: 10,
  stakeCurrency: 'USDT',
  stakeAmount: 100,
  dryRunWallet: 1000,
};

const defaultStrategy: EntryStrategyForm = {
  id: 'strategy-1',
  name: 'Entry Strategy 1',
  candlestick: [],
  indicators: [],
  entryConditions: emptyConditionTree(),
  startupCandleCount: 200,
  informativeTimeframes: [],
};

const defaultDirection: DirectionForm = {
  direction: 'long',
  orderType: 'market',
  limitOffsetPct: null,
};

const defaultCloseMethod: CloseMethodForm = {
  type: 'tp_sl',
  tpEnabled: true,
  tpLevels: [],
  slEnabled: true,
  slValue: -3,
  trailingEnabled: false,
  trailingPositive: 1,
  trailingOffset: 1.5,
  roiSteps: [],
  exitConditions: emptyConditionTree(),
};

const buildInitialState = (): BuilderState => {
  // Unique-ish defaults so each fresh bot (Create new bot → resetAll) gets a
  // distinct name. Reads the connected wallet + current time at call time.
  const { botName, strategyName } = makeDefaultNames(
    useWalletStore.getState().address,
    new Date(),
  );
  return {
    botName,
    botConfig: { ...defaultBotConfig },
    strategy: {
      ...defaultStrategy,
      name: strategyName,
      candlestick: [],
      indicators: [],
    },
    directionForm: { ...defaultDirection },
    closeMethod: { ...defaultCloseMethod, tpLevels: [], roiSteps: [] },
    notifications: { telegramEnabled: false, token: '', chatId: '' },
    stepStatus: {
      'bot-config': 'pending',
      'entry-strategy': 'pending',
      direction: 'pending',
      'close-method': 'pending',
    },
    isDirty: false,
    lastSavedAt: null,
  };
};

interface BuilderUIState {
  openStep: StepId | null;
  drawerTab: DrawerTab;
  drawerWidth: number;
}

interface BuilderActions {
  setBotName: (name: string) => void;
  setStepStatus: (id: StepId, status: StepStatus) => void;
  setOpenStep: (id: StepId | null) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  setDrawerWidth: (width: number) => void;
  patchBotConfig: (patch: Partial<BotConfigForm>) => void;
  patchStrategy: (patch: Partial<EntryStrategyForm>) => void;
  patchDirection: (patch: Partial<DirectionForm>) => void;
  patchCloseMethod: (patch: Partial<CloseMethodForm>) => void;
  setNotifications: (patch: Partial<NotificationForm>) => void;
  resetAll: () => void;
}

type BuilderStore = BuilderState & BuilderUIState & BuilderActions;

export const useBuilderStore = create<BuilderStore>()(
  persist(
    (set) => ({
      ...buildInitialState(),
      openStep: null,
      drawerTab: 'setup',
      drawerWidth: DEFAULT_DRAWER_WIDTH,

      setBotName: (name) =>
        set({ botName: name, isDirty: true, lastSavedAt: Date.now() }),

      setStepStatus: (id, status) =>
        set((s) => ({
          stepStatus: { ...s.stepStatus, [id]: status },
          isDirty: true,
          lastSavedAt: Date.now(),
        })),

      setOpenStep: (id) => set({ openStep: id, drawerTab: 'setup' }),

      setDrawerTab: (tab) => set({ drawerTab: tab }),

      setDrawerWidth: (width) =>
        set({
          drawerWidth: Math.max(
            MIN_DRAWER_WIDTH,
            Math.min(MAX_DRAWER_WIDTH, width),
          ),
        }),

      patchBotConfig: (patch) =>
        set((s) => ({
          botConfig: { ...s.botConfig, ...patch },
          isDirty: true,
          lastSavedAt: Date.now(),
        })),

      patchStrategy: (patch) =>
        set((s) => ({
          strategy: { ...s.strategy, ...patch },
          isDirty: true,
          lastSavedAt: Date.now(),
        })),

      patchDirection: (patch) =>
        set((s) => ({
          directionForm: { ...s.directionForm, ...patch },
          isDirty: true,
          lastSavedAt: Date.now(),
        })),

      patchCloseMethod: (patch) =>
        set((s) => ({
          closeMethod: { ...s.closeMethod, ...patch },
          isDirty: true,
          lastSavedAt: Date.now(),
        })),

      setNotifications: (patch) =>
        set((s) => ({
          notifications: { ...s.notifications, ...patch },
          isDirty: true,
          lastSavedAt: Date.now(),
        })),

      resetAll: () =>
        set({
          ...buildInitialState(),
          openStep: null,
          drawerTab: 'setup',
        }),
    }),
    {
      name: 'trading-bot-builder',
      version: 4,
      partialize: (state) => ({
        botName: state.botName,
        botConfig: state.botConfig,
        strategy: state.strategy,
        directionForm: state.directionForm,
        closeMethod: state.closeMethod,
        notifications: state.notifications,
        stepStatus: state.stepStatus,
        drawerWidth: state.drawerWidth,
        lastSavedAt: state.lastSavedAt,
      }),
      migrate: (persisted: unknown, fromVersion: number) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const s = persisted as {
          strategy?: { entryConditions?: unknown };
          closeMethod?: { exitConditions?: unknown };
          botConfig?: Record<string, unknown>;
        };
        // v2 → v3: flat `ConditionGroup` becomes `ConditionTree`. Reuse the
        // legacy migration helper so existing OR-chains are preserved instead
        // of collapsed into one giant AND group.
        if (fromVersion < 3) {
          if (
            s.strategy?.entryConditions &&
            'conditions' in (s.strategy.entryConditions as object) &&
            !('groups' in (s.strategy.entryConditions as object))
          ) {
            s.strategy.entryConditions = migrateLegacyGroup(
              s.strategy.entryConditions as Parameters<
                typeof migrateLegacyGroup
              >[0],
            );
          }
          if (
            s.closeMethod?.exitConditions &&
            'conditions' in (s.closeMethod.exitConditions as object) &&
            !('groups' in (s.closeMethod.exitConditions as object))
          ) {
            s.closeMethod.exitConditions = migrateLegacyGroup(
              s.closeMethod.exitConditions as Parameters<
                typeof migrateLegacyGroup
              >[0],
            );
          }
        }
        // v3 → v4: drop tradingMode (now a launch-time-only concern)
        if (fromVersion < 4 && s.botConfig) {
          delete s.botConfig['tradingMode'];
        }
        return s;
      },
    },
  ),
);
