import { createContext, useContext, type ReactNode } from 'react';

type SetHeaderActions = (actions: ReactNode) => void;

// Default no-op so a component that calls useHeaderActions() outside AppLayout
// (e.g. on the public Landing page) renders without crashing.
const HeaderActionsContext = createContext<SetHeaderActions>(() => {});

export const HeaderActionsProvider = HeaderActionsContext.Provider;

export function useHeaderActions(): SetHeaderActions {
  return useContext(HeaderActionsContext);
}
