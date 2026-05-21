import { Highlight, themes } from 'prism-react-renderer';
import { Code2 } from 'lucide-react';

interface JsonPreviewPaneProps {
  json: string;
  filename: string;
}

/**
 * Right pane of the deploy modal — pure JSON viewer.
 *
 * No actions live here (copy/download are owned by the header JsonActionGroup);
 * this is just a syntax-highlighted, scrollable, line-numbered preview so the
 * user can sanity-check what's about to ship to the BE.
 */
export function JsonPreviewPane({ json, filename }: JsonPreviewPaneProps) {
  const lineCount = json.split('\n').length;
  const fieldCount = (json.match(/^\s*"[^"]+":/gm) ?? []).length;
  const sizeKb = (new Blob([json]).size / 1024).toFixed(1);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* File header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-black/30 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-fg-muted">
          <Code2 className="h-3 w-3 shrink-0 text-brand" />
          <span className="truncate font-mono text-[11.5px] font-medium text-brand">
            {filename}
          </span>
        </div>
        <div className="shrink-0 font-mono text-[10.5px] tracking-wide text-fg-muted/70">
          {fieldCount} fields · {sizeKb} KB
        </div>
      </div>

      {/* Highlighted JSON with line gutter */}
      <div className="flex-1 overflow-auto py-3">
        <Highlight code={json} language="json" theme={themes.vsDark}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="grid grid-cols-[auto_1fr] font-mono text-[11.5px] leading-[1.65]">
              <div className="select-none border-r border-border px-3 text-right tabular-nums text-fg-muted/50">
                {tokens.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <code className="px-4">
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </code>
            </pre>
          )}
        </Highlight>
      </div>

      {/* Stats footer (line count) */}
      <div className="border-t border-border bg-black/30 px-4 py-1.5 font-mono text-[10px] text-fg-muted/60">
        {lineCount} lines
      </div>
    </div>
  );
}
