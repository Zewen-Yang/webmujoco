import { useState, type ReactNode } from 'react';

/**
 * Generic collapsible panel section used inside the side panels
 * (Robot Control on the right, Robot State on the left).
 */
export function Panel({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-[10px] border border-surface-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-surface-fg-muted hover:bg-surface-muted"
      >
        <span>{title}</span>
        <span aria-hidden className="w-3.5 text-center text-sm text-slate-400">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div className="flex flex-col gap-3 px-3 pb-3 pt-1">{children}</div>}
    </section>
  );
}

/**
 * Shared shell used by both side panels: a floating, collapsible aside with a
 * branded header. Children render inside a scrollable content area.
 */
export function SidePanelShell({
  title,
  side,
  collapsed,
  onToggleCollapsed,
  children,
}: {
  title: string;
  side: 'left' | 'right';
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children: ReactNode;
}) {
  const sideClasses = side === 'left' ? 'left-4' : 'right-4';
  const collapseGlyph =
    side === 'left' ? (collapsed ? '›' : '‹') : collapsed ? '‹' : '›';

  return (
    <aside
      className={
        `absolute ${sideClasses} top-4 z-10 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-surface-border bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md transition-[width] duration-200 ` +
        (collapsed ? 'w-14' : side === 'left' ? 'w-80' : 'w-72')
      }
    >
      <header className="flex items-center justify-between border-b border-surface-border bg-gradient-to-b from-white to-surface-muted px-3.5 py-3">
        {!collapsed && (
          <h1 className="m-0 truncate text-[13px] font-semibold tracking-wide text-surface-fg">
            {title}
          </h1>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-surface-border bg-transparent p-0 text-sm leading-none text-slate-500 transition hover:bg-slate-100 hover:text-surface-fg"
        >
          {collapseGlyph}
        </button>
      </header>

      {!collapsed && (
        <div className="flex flex-col gap-1.5 overflow-y-auto p-2">{children}</div>
      )}
    </aside>
  );
}
