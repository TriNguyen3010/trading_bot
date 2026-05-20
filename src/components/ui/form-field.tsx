import { type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Label } from './label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Optional explanatory copy. When set, a `?` icon sits next to the
   * label; hover/focus shows this as a tooltip. Use for fields whose
   * intent isn't obvious from the label alone (e.g. Margin mode, Leverage). */
  help?: ReactNode;
  /** Optional content rendered at the far right of the label row — e.g.
   * a compact toggle that gates an advanced option. Pushed against the
   * row's trailing edge with `ml-auto`. */
  trailing?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Standard label + control + helper-text wrapper. All forms in the right
 * drawer use this so spacing, label tone and error messages stay consistent.
 */
export function FormField({
  label,
  htmlFor,
  required,
  help,
  trailing,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </Label>
        {help ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="More info"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs text-xs leading-snug"
              >
                {help}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {trailing ? <div className="ml-auto">{trailing}</div> : null}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
