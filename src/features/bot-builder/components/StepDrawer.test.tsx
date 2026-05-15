import { useState } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StepDrawer, type StepContentMap } from './StepDrawer';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import type { StepId } from '@/types/builder.types';

const CONTENT: Record<StepId, StepContentMap> = {
  'bot-config': {
    setup: <div data-testid="bot-config-setup">bot-config setup body</div>,
    configure: <div>cfg</div>,
    title: 'Bot Config',
    description: 'desc',
    index: 1,
  },
  'entry-strategy': {
    setup: <div data-testid="entry-setup">entry setup body</div>,
    configure: <div>cfg</div>,
    title: 'Entry Strategy',
    description: 'desc',
    index: 2,
  },
  direction: {
    setup: <div data-testid="dir-setup">dir setup body</div>,
    configure: <div>cfg</div>,
    title: 'Direction & Order',
    description: 'desc',
    index: 3,
  },
  'close-method': {
    setup: <div data-testid="close-setup">close setup body</div>,
    configure: <div>cfg</div>,
    title: 'Close Method',
    description: 'desc',
    index: 4,
  },
};

const noop = () => {};

const baseProps = {
  contentByStep: CONTENT,
  onManualClose: noop,
  onManualSave: noop,
  onManualSaveAndNext: noop,
  hasNext: true,
};

describe('StepDrawer integration', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('Phase 1 (setup tab, !setupComplete): renders Cancel + Continue disabled', async () => {
    // pristine bot-config has empty pair → setup incomplete.
    useBuilderStore.getState().setOpenStep('bot-config');
    render(<StepDrawer {...baseProps} />);
    expect(await screen.findByText('Cancel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    // Phase 1 shows neither Save nor Skip & Save.
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /skip & save/i })).toBeNull();
    expect(screen.getByTestId('bot-config-setup')).toBeInTheDocument();
  });

  it('Phase 2 (setup tab, setupComplete): renders Cancel + Skip & Save + Continue', async () => {
    useBuilderStore.getState().patchBotConfig({
      pair: 'BTC-USDC',
      timeframe: '5m',
      leverage: 1,
    });
    useBuilderStore.getState().setOpenStep('bot-config');
    render(<StepDrawer {...baseProps} />);
    expect(await screen.findByText('Cancel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip & save/i })).toBeInTheDocument();
    const cont = screen.getByRole('button', { name: /continue/i });
    expect(cont).not.toBeDisabled();
  });

  it('Phase 1 composite (bot-config): renders the merged body, no Setup/Configure tabs', async () => {
    useBuilderStore.getState().patchBotConfig({
      pair: 'BTC-USDC',
      timeframe: '5m',
      leverage: 1,
    });
    useBuilderStore.getState().setOpenStep('bot-config');
    render(
      <StepDrawer
        {...baseProps}
        botConfigCompositeContent={
          <div data-testid="composite-bot-config">
            <button>Cancel</button>
            <button>Save</button>
          </div>
        }
        botConfigHeader={{ title: 'Bot Basics', description: 'merged' }}
      />,
    );
    // Composite body shown.
    expect(await screen.findByTestId('composite-bot-config')).toBeInTheDocument();
    // Title without the "Step 1: " prefix.
    expect(screen.getByText(/^Bot Basics$/)).toBeInTheDocument();
    expect(screen.queryByText(/^Step 1:/)).toBeNull();
    // Legacy Setup/Configure tabs gone.
    expect(screen.queryByRole('tab', { name: /^Setup$/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^Configure$/ })).toBeNull();
    // Legacy wizard footer (Continue / Skip & Save) gone.
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /skip & save/i })).toBeNull();
  });

  it('closes when clicking outside the side panel', async () => {
    useBuilderStore.getState().setOpenStep('bot-config');
    render(
      <StepDrawer
        {...baseProps}
        onManualClose={() => useBuilderStore.getState().setOpenStep(null)}
      />,
    );

    expect(await screen.findByText('Cancel')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(useBuilderStore.getState().openStep).toBeNull();
    });
  });

  it('stays open when pressing inside a nested Radix Dialog (e.g. Live-trade confirm)', async () => {
    // Repro for the "Live trade" bug: the confirmation Dialog inside
    // BotConfig is portaled to <body>, so the drawer's outside-press
    // listener used to treat clicks on the confirm button as "outside"
    // and silently closed the drawer before the user could confirm.
    function NestedDialogContent() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open nested
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Nested</DialogTitle>
              <button type="button">confirm nested</button>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    const contentWithDialog: Record<StepId, StepContentMap> = {
      ...CONTENT,
      'bot-config': {
        ...CONTENT['bot-config'],
        setup: <NestedDialogContent />,
      },
    };

    useBuilderStore.getState().setOpenStep('bot-config');
    render(
      <StepDrawer
        {...baseProps}
        contentByStep={contentWithDialog}
        onManualClose={() => useBuilderStore.getState().setOpenStep(null)}
      />,
    );

    fireEvent.click(await screen.findByText('open nested'));
    const confirm = await screen.findByRole('button', {
      name: 'confirm nested',
    });

    fireEvent.pointerDown(confirm);
    fireEvent.mouseDown(confirm);

    expect(useBuilderStore.getState().openStep).toBe('bot-config');
  });
});
