import type { ReactNode } from 'react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { strings } from '@/i18n/en';
import { DrawerResizeHandle } from './DrawerResizeHandle';
import type { DrawerTab, StepId } from '@/types/builder.types';

export interface StepDrawerProps {
  stepId: StepId;
  title: string;
  description: string;
  /** Optional Setup tab body. */
  setupContent?: ReactNode;
  /** Optional Configure tab body. */
  configureContent?: ReactNode;
  /** Whether this drawer should be open (true when openStep === stepId). */
  open: boolean;
  /** Called when the user closes the drawer. */
  onClose: () => void;
  /** Called when the user clicks Save (without next). */
  onSave: () => void;
  /** Called when the user clicks Save & Next. */
  onSaveAndNext: () => void;
  /** When false the Save & Next button is omitted (last step). */
  hasNext?: boolean;
}

export function StepDrawer({
  title,
  description,
  setupContent,
  configureContent,
  open,
  onClose,
  onSave,
  onSaveAndNext,
  hasNext = true,
}: StepDrawerProps) {
  const drawerTab = useBuilderStore((s) => s.drawerTab);
  const setDrawerTab = useBuilderStore((s) => s.setDrawerTab);
  const drawerWidth = useBuilderStore((s) => s.drawerWidth);
  const setDrawerWidth = useBuilderStore((s) => s.setDrawerWidth);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()} modal={false}>
      <SheetContent
        hideOverlay
        width={drawerWidth}
        onInteractOutside={(e) => e.preventDefault()}
        overlayClassName="left-[var(--layout-left-panel)]"
      >
        <DrawerResizeHandle currentWidth={drawerWidth} onResize={setDrawerWidth} />
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <Tabs
          value={drawerTab}
          onValueChange={(v) => setDrawerTab(v as DrawerTab)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="setup">{strings.drawer.setupTab}</TabsTrigger>
              <TabsTrigger value="configure">
                {strings.drawer.configureTab}
              </TabsTrigger>
            </TabsList>
          </div>
          <SheetBody>
            <TabsContent value="setup" className="space-y-5">
              {setupContent ?? (
                <DrawerPlaceholder label={strings.drawer.setupTab} />
              )}
            </TabsContent>
            <TabsContent value="configure" className="space-y-5">
              {configureContent ?? (
                <DrawerPlaceholder label={strings.drawer.configureTab} />
              )}
            </TabsContent>
          </SheetBody>
        </Tabs>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>
            {strings.drawer.cancel}
          </Button>
          <Button variant="secondary" onClick={onSave}>
            {strings.drawer.save}
          </Button>
          {hasNext ? (
            <Button variant="primary" onClick={onSaveAndNext}>
              {strings.drawer.saveAndNext}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DrawerPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-canvas/40 p-6 text-center text-sm text-fg-muted">
      <span className="font-medium text-fg-secondary">{label} fields</span>
      <span>Form will be wired up in milestone M2.</span>
    </div>
  );
}
