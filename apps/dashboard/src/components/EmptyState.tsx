import { AlertTriangle, Inbox, Loader2, WifiOff } from 'lucide-react';
import type { AfroIcon, PanelStateKind } from '../dashboard-types';

/** Optional action rendered at the inline-end of a panel state (e.g. retry / create). */
export interface PanelStateAction {
  icon?: AfroIcon;
  label: string;
  onClick: () => void;
}

/**
 * Shared empty-state primitive: icon slot, title, optional description, and an
 * optional action button. All copy must come from the typed en/fa layer.
 */
export function EmptyState({
  action,
  detail,
  icon,
  kind = 'empty',
  message,
}: {
  action?: PanelStateAction;
  detail?: string;
  icon?: AfroIcon;
  kind?: PanelStateKind;
  message: string;
}) {
  return <PanelState action={action} detail={detail} icon={icon} kind={kind} title={message} />;
}

export function PanelState({
  action,
  detail,
  icon,
  kind,
  title,
}: {
  action?: PanelStateAction;
  detail?: string;
  icon?: AfroIcon;
  kind: PanelStateKind;
  title: string;
}) {
  const Icon = icon ?? panelStateIcon(kind);
  const ActionIcon = action?.icon;
  const toneClass = panelStateClass(kind);
  const iconClass = kind === 'loading' ? 'animate-spin' : '';

  return (
    <div
      className={`flex min-h-[58px] flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2.5 ${toneClass}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/70">
        <Icon className={iconClass} size={16} />
      </span>
      <span className="min-w-0 flex-1 basis-40">
        <strong className="block truncate text-[13px] leading-tight">{title}</strong>
        {detail ? <span className="mt-0.5 block text-[12px] leading-snug opacity-80">{detail}</span> : null}
      </span>
      {action ? (
        <button
          className="ms-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-afro-line bg-white px-3 text-[13px] font-bold text-afro-ink hover:border-afro-teal hover:text-afro-teal md:min-h-9"
          onClick={action.onClick}
          type="button"
        >
          {ActionIcon ? <ActionIcon size={13} /> : null}
          {action.label}
        </button>
      ) : null}
    </div>
  );
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
