/**
 * All user-facing strings live here so we can swap to a different locale
 * (e.g. Vietnamese) without touching components.
 */
export const strings = {
  app: {
    title: 'Strategy Builder',
    subtitle: 'Design, configure and export your trading bot strategy.',
  },
  header: {
    botNamePlaceholder: 'Untitled bot',
    backtest: 'Backtest',
    export: 'Export',
    saved: 'Saved',
    saving: 'Saving…',
    secondsAgo: (s: number) => `${s}s ago`,
  },
  cypheus: {
    tabLabel: 'Cypheus',
    jsonTabLabel: 'JSON',
    inputPlaceholder: "Tell Cypheus what you're building...",
    send: 'Send',
    createNewBot: 'Create new bot',
    confirmReset: {
      title: 'Start a new bot?',
      body: 'Your current configuration will be cleared.',
      confirm: 'Start over',
      cancel: 'Cancel',
    },
    greeting: {
      hello: "Hi, I'm Cypheus.",
      pitch:
        "I'll help you build your first trading bot. Tell me what you have in mind.",
    },
    magicBuild: {
      ack: 'Got it. Let me build a Bollinger Breakout strategy on BTC-USDC for you.',
      note: 'Note: This is demo content prepared to showcase the AI flow.',
      step1: 'Setting up bot configuration...',
      step1Comment:
        'BTC-USDC offers high liquidity. 5-minute timeframe is ideal for scalping.',
      step2: 'Defining entry conditions...',
      step2Comment:
        'RSI below 30 signals oversold – a classic buy entry.',
      step3: 'Going Long with Market orders for fast fills.',
      step4: 'Setting take-profit and stop-loss.',
      step4Comment:
        '5% take-profit at half position, another 25% at 10% profit. 3% stop-loss.',
      doneA: 'All set.',
      doneB:
        'Review the JSON in the {} JSON tab, then click Export when ready.',
    },
    afterDone:
      'Demo complete. Click Create new bot to start over, or explore the configuration manually.',
    progress: {
      empty: 'Set up your bot to get started',
      configured: (n: number) => `${n} / 4 steps configured`,
      issues: (n: number) => `${n} ${n === 1 ? 'issue' : 'issues'}`,
      issuesBlock: (n: number) =>
        `${n} ${n === 1 ? 'issue' : 'issues'} ${n === 1 ? 'blocks' : 'block'} export`,
      ready: 'Ready to export',
      fix: 'Fix',
      export: 'Export bot',
    },
  },
  steps: {
    botConfig: {
      title: 'Bot Config',
      description: 'Pick the market, timeframe and trading mode.',
    },
    entryStrategy: {
      title: 'Entry Strategy',
      description: 'Add indicators and define entry conditions.',
    },
    direction: {
      title: 'Direction & Order',
      description: 'Long or Short, market or limit.',
    },
    closeMethod: {
      title: 'Close Method',
      description: 'How and when the bot exits.',
    },
    addStrategy: {
      title: 'Add strategy',
      description: 'Multi-strategy support is on the way.',
      comingSoon: 'Coming soon',
    },
  },
  drawer: {
    setupTab: 'Setup',
    configureTab: 'Configure',
    cancel: 'Cancel',
    save: 'Save',
    saveAndNext: 'Save & Next →',
    close: 'Close',
  },
} as const;

export type Strings = typeof strings;
