import { Code2, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JsonActionGroupProps {
  /** Currently expanded preview pane state — controls the "<>" button's active style */
  previewOpen: boolean;
  onTogglePreview: () => void;
  onCopy: () => void;
  onDownload: () => void;
  /** Disables actions while bundle is unavailable (validation errors etc.) */
  disabled?: boolean;
}

/**
 * The 3 JSON-related actions in the deploy modal header — preview / copy /
 * download — as a segmented button cluster. A plain "JSON" text label sits
 * BEFORE the cluster (outside the frame) so it reads as a label, not a button.
 */
export function JsonActionGroup({
  previewOpen,
  onTogglePreview,
  onCopy,
  onDownload,
  disabled,
}: JsonActionGroupProps) {
  return (
    <div className="inline-flex items-center gap-2">
      {/* Plain text label — NOT inside the button frame, so it reads as a
          label, not a clickable button. The 3 icons below are the buttons. */}
      <span className="select-none font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-fg-muted">
        JSON
      </span>

      <div
        role="group"
        aria-label="JSON actions"
        className="inline-flex h-8 items-stretch overflow-hidden rounded-lg border border-border bg-white/[0.025]"
      >
        <ActionBtn
          title={previewOpen ? 'Hide JSON preview' : 'Preview JSON'}
          active={previewOpen}
          aria-pressed={previewOpen}
          onClick={onTogglePreview}
          disabled={disabled}
        >
          <Code2 className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn
          title="Copy JSON to clipboard"
          onClick={onCopy}
          disabled={disabled}
        >
          <Copy className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn
          title="Download .json file"
          onClick={onDownload}
          disabled={disabled}
          last
        >
          <Download className="h-3.5 w-3.5" />
        </ActionBtn>
      </div>
    </div>
  );
}

interface ActionBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  last?: boolean;
}

function ActionBtn({
  active,
  last,
  className,
  children,
  ...rest
}: ActionBtnProps) {
  return (
    <button
      type="button"
      className={cn(
        'relative grid h-full w-8 place-items-center text-fg-muted transition-colors duration-150',
        !last && 'border-r border-border',
        'hover:bg-white/[0.05] hover:text-fg',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-muted',
        active &&
          'bg-brand-subtle text-brand hover:bg-brand-subtle hover:text-brand',
        className,
      )}
      {...rest}
    >
      {children}
      {active ? (
        <span
          aria-hidden
          className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-t-sm bg-brand"
        />
      ) : null}
    </button>
  );
}
