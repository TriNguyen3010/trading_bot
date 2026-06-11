import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { HeaderActionsProvider } from './header-actions-context';

// =============================================================================
// AppLayout · shared chrome for the authed app (Dashboard / Builder / Detail).
//
// AppHeader mounts ONCE here; child routes render through <Outlet/>. Because the
// header never unmounts between these routes, the active-tab pill can slide
// (framer-motion layoutId) and the Builder can push its action cluster into the
// header via HeaderActionsContext.
// =============================================================================
export function AppLayout() {
  const [actions, setActions] = useState<ReactNode>(null);
  return (
    <HeaderActionsProvider value={setActions}>
      <div className="flex h-screen w-screen flex-col bg-black text-fg">
        <AppHeader actions={actions} />
        <Outlet />
      </div>
    </HeaderActionsProvider>
  );
}
