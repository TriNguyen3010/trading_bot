import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutPrefsStore } from '../layout-prefs.store';

describe('layout-prefs.store · summaryMode', () => {
  beforeEach(() => {
    useLayoutPrefsStore.setState({
      leftPanelCollapsed: false,
      botSummaryHidden: false,
      summaryMode: 'visual',
    });
  });

  it('defaults summaryMode to "visual"', () => {
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('visual');
  });

  it('toggleSummaryMode flips visual → narrative → visual', () => {
    const { toggleSummaryMode } = useLayoutPrefsStore.getState();
    toggleSummaryMode();
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
    toggleSummaryMode();
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('visual');
  });

  it('setSummaryMode sets explicit value', () => {
    useLayoutPrefsStore.getState().setSummaryMode('narrative');
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
  });
});
