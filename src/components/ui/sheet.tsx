import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]',
      'data-[state=open]:animate-fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Sheet width — defaults to 720px (matches MVP spec). */
  width?: number;
  /** When false the close (×) button in the header is hidden. */
  hideCloseButton?: boolean;
  /** Hides the dim overlay so the canvas behind can stay click-through. */
  hideOverlay?: boolean;
  /**
   * Extra classes for the overlay. Used to inset the dim layer (e.g. so the
   * left Cypheus panel stays bright while the canvas dims).
   */
  overlayClassName?: string;
}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      className,
      children,
      width = 720,
      hideCloseButton,
      hideOverlay,
      overlayClassName,
      ...props
    },
    ref,
  ) => (
  <SheetPortal>
    {!hideOverlay ? <SheetOverlay className={overlayClassName} /> : null}
    <DialogPrimitive.Content
      ref={ref}
      style={{ width }}
      className={cn(
        'card-coin98 fixed inset-y-0 right-0 z-50 flex flex-col rounded-l-3xl shadow-2xl',
        'data-[state=open]:animate-slide-in-right',
        'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
        className,
      )}
      {...props}
    >
      {children}
      {!hideCloseButton ? (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-black/40 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Close drawer"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </SheetPortal>
  ),
);
SheetContent.displayName = 'SheetContent';

export const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col gap-1 px-6 pt-5 pb-4',
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-fg', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-fg-secondary', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

export const SheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex-1 overflow-y-auto px-6 py-5 scrollbar-thin',
      className,
    )}
    {...props}
  />
);
SheetBody.displayName = 'SheetBody';

export const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex items-center justify-end gap-3 px-6 py-4',
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';
