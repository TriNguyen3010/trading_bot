import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BuilderState,
  BotConfigForm,
  CloseMethodForm,
  ConditionGroup,
  DirectionForm,
  DrawerTab,
  EntryStrategyForm,
  StepId,
  StepStatus,
} from '@/types/builder.types';

const DEFAULT_DRAWER_WIDTH = 720;
const MIN_DRAWER_WIDTH = 480;
const MAX_DRAWER_WIDTH = 1200;

const emptyConditionGroup: ConditionGroup = {
  logic: { type: 'AND', threshold: null },
  conditions: [],
};

const defaultBotConfig: BotConfigForm = {
  pair: '',
  timeframe: '5m',
  tradingMode: 'dry-run',
  leverage: 1,
  exchange: 'binance',
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
  entryConditions: { ...emptyConditionGroup, conditions: [] },
  startupCandleCount: 200,
  informativeTimeframes: [],
};

const defaultDirection: DirectionForm = {
  direction: 'long',
  orderType: 'market',
  limitOffsetPct: null,
  slippageTolerance: 0.5,
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
  exitConditions: { ...emptyConditionGroup, conditions: [] },
};

const buildInitialState = (): BuilderState => ({
  botName: 'Untitled bot',
  botConfig: { ...defaultBotConfig },
  strategy: { ...defaultStrategy, candlestick: [], indicators: [] },
  directionForm: { ...defaultDirection },
  closeMethod: { ...defaultCloseMethod, tpLevels: [], roiSteps: [] },
  stepStatus: {
    'bot-config': 'pending',
    'entry-strategy': 'pending',
    direction: 'pending',
    'close-method': 'pending',
  },
  isDirty: false,
  lastSavedAt: null,
});

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

      setDrawerWidth: (width) => set({
        drawerWidth: Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, width)),
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

      resetAll: () =>
        set({
          ...buildInitialState(),
          openStep: null,
          drawerTab: 'setup',
        }),
    }),
    {
      name: 'trading-bot-builder',
      version: 1,
      partialize: (state) => ({
        botName: state.botName,
        botConfig: state.botConfig,
        strategy: state.strategy,
        directionForm: state.directionForm,
        closeMethod: state.closeMethod,
        stepStatus: state.stepStatus,
        drawerWidth: state.drawerWidth,
        lastSavedAt: state.lastSavedAt,
      }),
    },
  ),
);
