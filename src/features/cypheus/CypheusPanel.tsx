import { useEffect } from 'react';
import { Sparkles, Braces } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CypheusChat } from './CypheusChat';
import { CypheusInput } from './CypheusInput';
import { CreateNewBotButton } from './CreateNewBotButton';
import { JsonLiveView } from './JsonLiveView';
import { SetupProgress } from './setup-progress/SetupProgress';
import {
  useCypheusStore,
  type LeftPanelTab,
} from './store/cypheus.store';
import { runGreeting } from './script/greeting.script';
import { runMagicBuild } from './script/magic-build.script';
import { strings } from '@/i18n/en';

export function CypheusPanel() {
  const tab = useCypheusStore((s) => s.panelTab);
  const setTab = useCypheusStore((s) => s.setPanelTab);
  const state = useCypheusStore((s) => s.state);
  const messages = useCypheusStore((s) => s.messages);
  const pushMessage = useCypheusStore((s) => s.pushMessage);

  // Auto-run greeting when the panel renders without messages yet (fresh
  // session or after "Create new bot" reset).
  useEffect(() => {
    if (state === 'idle' && messages.length === 0) {
      void runGreeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUserSubmit = (text: string) => {
    pushMessage({ role: 'user', text });
    if (state === 'building' || state === 'thinking') {
      // Ignore second submit during demo build.
      return;
    }
    if (state === 'done') {
      // After magic build completes, fall back to the canned response.
      pushMessage({ role: 'cypheus', text: strings.cypheus.afterDone });
      return;
    }
    void runMagicBuild();
  };

  const inputDisabled = state === 'thinking' || state === 'building';

  return (
    <aside
      className="flex h-full w-[var(--layout-left-panel)] flex-shrink-0 flex-col border-r border-border-subtle bg-canvas"
      aria-label="Cypheus assistant panel"
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as LeftPanelTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="px-4 pt-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="cypheus" className="flex-1 justify-start">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{strings.cypheus.tabLabel}</span>
            </TabsTrigger>
            <TabsTrigger value="json" className="flex-1 justify-start">
              <Braces className="h-3.5 w-3.5" />
              <span>{strings.cypheus.jsonTabLabel}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="cypheus"
          className="data-[state=active]:flex flex-1 flex-col overflow-hidden"
        >
          <CypheusChat />
          <div className="bg-canvas">
            <SetupProgress />
            <CypheusInput
              onSubmit={handleUserSubmit}
              disabled={inputDisabled}
            />
            <div className="px-4 pb-3">
              <CreateNewBotButton />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="json" className="data-[state=active]:flex flex-1 flex-col overflow-hidden">
          <JsonLiveView />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
