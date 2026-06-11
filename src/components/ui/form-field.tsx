import { type ReactNode } from 'react';
import { Label } from './label';
import { InfoHint } from './info-hint';
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
        {help ? <InfoHint text={help} /> : null}
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
