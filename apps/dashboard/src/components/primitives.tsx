import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, WifiOff } from 'lucide-react';
import type { AfroIcon, DataState, PanelStateKind } from '../dashboard-types';
import type { DashboardStrings } from '../i18n';
import { mutedTextClass } from '../ui-classes';

export function primitiveTooltip(value: ReactNode): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return undefined;
}

export function DetailRow({ children, label }: { children: ReactNode; label: string }) {
  const valueTooltip = primitiveTooltip(children);
  const rowTooltip = valueTooltip ? `${label} ${valueTooltip}` : label;

  return (
    <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" title={rowTooltip}>
      <span className={`${mutedTextClass} min-w-0 truncate`} title={label}>{label}</span>
      <strong className="min-w-0 shrink text-right text-sm" title={valueTooltip}>{children}</strong>
    </div>
  );
}

export function EmptyState({ detail, kind = 'empty', message }: { detail?: string; kind?: PanelStateKind; message: string }) {
  return <PanelState detail={detail} kind={kind} title={message} />;
}

export function PanelState({
  detail,
  kind,
  title,
}: {
  detail?: string;
  kind: PanelStateKind;
  title: string;
}) {
  const Icon = panelStateIcon(kind);
  const toneClass = panelStateClass(kind);
  const iconClass = kind === 'loading' ? 'animate-spin' : '';

  return (
    <div
      className={`flex min-h-[58px] items-center gap-2 rounded-md border border-dashed px-3 py-2.5 ${toneClass}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/70">
        <Icon className={iconClass} size={16} />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[13px] leading-tight">{title}</strong>
        {detail ? <span className="mt-0.5 block text-[12px] leading-snug opacity-80">{detail}</span> : null}
      </span>
    </div>
  );
}

export function DataStateNotice({ state, t }: { state: DataState; t: DashboardStrings }) {
  const kind = dataStatePanelKind(state);
  if (!kind) return null;

  return (
    <PanelState
      detail={dataStatePanelDetail(state, t)}
      kind={kind}
      title={dataStatePanelTitle(state, t)}
    />
  );
}

export function DataStateEmpty({
  emptyMessage,
  state,
  t,
}: {
  emptyMessage: string;
  state: DataState;
  t: DashboardStrings;
}) {
  const kind = dataStatePanelKind(state) ?? 'empty';
  const detail = kind === 'empty' ? t.panelStates.emptyDetail : dataStatePanelDetail(state, t);
  const title = kind === 'empty' ? emptyMessage : dataStatePanelTitle(state, t);

  return <PanelState detail={detail} kind={kind} title={title} />;
}

export function dataStatePanelKind(state: DataState): PanelStateKind | null {
  if (state === 'loading') return 'loading';
  if (state === 'stale') return 'stale';
  if (state === 'fallback') return 'fallback';

  return null;
}

export function dataStatePanelTitle(state: DataState, t: DashboardStrings): string {
  if (state === 'loading') return t.panelStates.loadingTitle;
  if (state === 'stale') return t.panelStates.staleTitle;
  if (state === 'fallback') return t.panelStates.fallbackTitle;

  return t.panelStates.emptyTitle;
}

export function dataStatePanelDetail(state: DataState, t: DashboardStrings): string {
  if (state === 'loading') return t.panelStates.loadingDetail;
  if (state === 'stale') return t.panelStates.staleDetail;
  if (state === 'fallback') return t.panelStates.fallbackDetail;

  return t.panelStates.emptyDetail;
}

export function panelStateIcon(kind: PanelStateKind): AfroIcon {
  if (kind === 'loading') return Loader2;
  if (kind === 'stale') return WifiOff;
  if (kind === 'empty') return Inbox;

  return AlertTriangle;
}

export function panelStateClass(kind: PanelStateKind): string {
  if (kind === 'loading') return 'border-[#bfd1ea] bg-[#edf4ff] text-afro-blue';
  if (kind === 'stale') return 'border-[#e6cf9c] bg-[#fff7e6] text-[#9a5b00]';
  if (kind === 'fallback') return 'border-afro-line bg-[#f8fafb] text-afro-muted';
  if (kind === 'error') return 'border-[#f0b7b7] bg-[#fff1f1] text-[#b91c1c]';

  return 'border-afro-line bg-[#f8fafb] text-afro-muted';
}
