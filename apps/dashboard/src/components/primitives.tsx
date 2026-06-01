import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, WifiOff } from 'lucide-react';
import type {
  AfroIcon,
  DashboardTabItem,
  DataState,
  DataTableColumn,
  MetricCardData,
  PanelStateKind,
  TableCellAlign,
  Tone,
} from '../dashboard-types';
import { clamp, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { mutedTextClass, panelClass } from '../ui-classes';

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

export function StatusBadge({
  ariaLabel,
  children,
  title,
  tone,
}: {
  ariaLabel?: string;
  children: ReactNode;
  title?: string;
  tone: Tone;
}) {
  const toneClass = {
    good: 'border-[#b8e1cf] bg-[#e7f6ef] text-afro-green',
    neutral: 'border-[#bfd1ea] bg-[#edf4ff] text-afro-blue',
    warning: 'border-[#e6cf9c] bg-[#fff7e6] text-[#9a5b00]',
    critical: 'border-[#f0b7b7] bg-[#fff1f1] text-[#b91c1c]',
  }[tone];
  const tooltip = title ?? primitiveTooltip(children);

  return (
    <span
      aria-label={ariaLabel ?? tooltip}
      className={`inline-flex min-h-[22px] max-w-full min-w-0 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border px-1.5 text-[11px] font-bold ${toneClass}`}
      title={tooltip}
    >
      {children}
    </span>
  );
}

export function MetricCard({ item }: { item: MetricCardData }) {
  const toneClass = {
    good: 'border-t-afro-green',
    neutral: 'border-t-afro-blue',
    warning: 'border-t-[#c27a1a]',
    critical: 'border-t-[#b91c1c]',
  }[item.tone];
  const tooltip = `${item.label} ${item.value}`;

  return (
    <div
      aria-label={tooltip}
      className={`grid min-h-[62px] gap-1 rounded-md border border-t-4 border-afro-line bg-afro-panel p-2.5 ${toneClass}`}
      title={tooltip}
    >
      <span className="truncate text-[12px] text-afro-muted" title={item.label}>{item.label}</span>
      <strong className="truncate text-[19px] leading-tight" title={item.value}>{item.value}</strong>
    </div>
  );
}

export function UsageBar({
  format,
  icon: Icon,
  label,
  value,
  invert = false,
}: {
  format: DashboardFormatters;
  icon: AfroIcon;
  label: string;
  value: number | null;
  invert?: boolean;
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const boundedValue = hasValue ? clamp(value, 0, 100) : 0;
  const fillValue = invert ? 100 - boundedValue : boundedValue;
  const displayValue = format.percent(hasValue ? value : null);

  return (
    <span
      aria-label={`${label} ${displayValue}`}
      className="inline-flex min-h-[19px] min-w-[46px] items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-tight text-[#243238]"
      style={{
        background: `linear-gradient(90deg, #a9d8d1 ${fillValue}%, #edf2f4 0)`,
      } as CSSProperties}
      title={`${label} ${displayValue}`}
    >
      <Icon className="shrink-0" size={12} />
      <span className="whitespace-nowrap font-bold">{displayValue}</span>
    </span>
  );
}

export function MetricPill({ icon: Icon, label, value }: { icon: AfroIcon; label: string; value: string }) {
  return (
    <span
      aria-label={`${label} ${value}`}
      className="inline-flex min-h-[19px] min-w-[64px] max-w-full items-center justify-center gap-1 rounded-full bg-[#f4f7f8] px-1.5 py-0.5 text-[11px] font-bold leading-tight text-afro-ink"
      title={`${label} ${value}`}
    >
      <Icon className="shrink-0 text-afro-muted" size={12} />
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}

export function PanelHeading({
  title,
  icon: Icon,
  meta,
}: {
  title: string;
  icon: AfroIcon;
  meta?: string;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2 border-b border-afro-line pb-1.5">
      <PanelHeadingContent title={title} meta={meta} />
      <Icon size={16} />
    </div>
  );
}

export function PanelHeadingContent({ title, meta, titleId }: { title: string; meta?: string; titleId?: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 className="truncate text-[14px] font-bold" id={titleId} title={title}>{title}</h2>
      {meta ? <span className={`${mutedTextClass} min-w-0 truncate before:mx-1.5 before:text-afro-line before:content-['/']`} title={meta}>{meta}</span> : null}
    </div>
  );
}

export function DashboardTabs<T extends string>({
  activeTab,
  ariaLabel,
  onChange,
  tabs,
}: {
  activeTab: T;
  ariaLabel: string;
  onChange: (tab: T) => void;
  tabs: Array<DashboardTabItem<T>>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-afro-line bg-afro-panel p-1" role="presentation">
      <div aria-label={ariaLabel} className="grid min-w-max grid-flow-col gap-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              aria-selected={isActive}
              className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded px-3 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${isActive ? 'bg-afro-sidebar text-white shadow-sm' : 'bg-white text-afro-muted hover:text-afro-ink'}`}
              disabled={tab.disabled}
              key={tab.id}
              onClick={() => onChange(tab.id)}
              role="tab"
              title={tab.meta ? `${tab.label} / ${tab.meta}` : tab.label}
              type="button"
            >
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.meta ? <span className="rounded-full bg-black/10 px-1.5 text-[11px]">{tab.meta}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DataTable<Row>({
  columns,
  minWidth = '760px',
  rowClassName,
  rowKey,
  rows,
}: {
  columns: Array<DataTableColumn<Row>>;
  minWidth?: string;
  rowClassName?: (row: Row) => string | undefined;
  rowKey: (row: Row) => string;
  rows: Row[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                className={`border-b border-afro-line px-2 py-1.5 text-[13px] font-bold text-afro-muted first:pl-0 last:pr-0 ${tableAlignmentClass(column.align, column.alignRight)} ${column.className ?? ''}`}
                key={column.key}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className={rowClassName?.(row)} key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell align={column.align} alignRight={column.alignRight} key={column.key}>
                  {column.render(row)}
                </TableCell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function tableAlignmentClass(align?: TableCellAlign, alignRight = false): string {
  if (align === 'center') return 'text-center';
  if (align === 'right' || alignRight) return 'text-right';

  return 'text-left';
}

export function TableCell({ align, alignRight = false, children }: { align?: TableCellAlign; alignRight?: boolean; children: ReactNode }) {
  const alignmentClass = tableAlignmentClass(align, alignRight);
  const tooltip = primitiveTooltip(children);

  return (
    <td className={`border-b border-afro-line px-2 py-1.5 text-[13px] text-afro-muted first:pl-0 last:pr-0 ${alignmentClass}`} title={tooltip}>
      {children}
    </td>
  );
}

export function BackupMetricCard({ label, tone, value }: { label: string; tone: Tone; value: string }) {
  return (
    <div className={panelClass}>
      <span className={mutedTextClass}>{label}</span>
      <strong className={`mt-1 block truncate text-[18px] leading-tight ${tone === 'critical' ? 'text-[#b91c1c]' : tone === 'warning' ? 'text-[#9a5b00]' : 'text-afro-ink'}`} title={value}>
        {value}
      </strong>
    </div>
  );
}
