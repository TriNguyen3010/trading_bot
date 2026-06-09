import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutPrefsStore } from '../layout-prefs.store';

describe('layout-prefs.store · summaryMode', () => {
  beforeEach(() => {
    useLayoutPrefsStore.setState({
      leftPanelCollapsed: true,
      botSummaryHidden: false,
      summaryMode: 'visual',
      summaryHintUnseen: false,
    });
  });

  it('defaults the Cypheus panel to collapsed', () => {
    expect(useLayoutPrefsStore.getInitialState().leftPanelCollapsed).toBe(true);
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

  it('defaults summaryHintUnseen to false', () => {
    expect(useLayoutPrefsStore.getInitialState().summaryHintUnseen).toBe(false);
  });

  it('setSummaryHintUnseen sets the flag', () => {
    useLayoutPrefsStore.getState().setSummaryHintUnseen(true);
    expect(useLayoutPrefsStore.getState().summaryHintUnseen).toBe(true);
  });

  it('toggleSummaryMode clears summaryHintUnseen (user saw the toggle)', () => {
    useLayoutPrefsStore.setState({ summaryHintUnseen: true });
    useLayoutPrefsStore.getState().toggleSummaryMode();
    expect(useLayoutPrefsStore.getState().summaryHintUnseen).toBe(false);
  });
});
