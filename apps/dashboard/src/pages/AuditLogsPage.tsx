import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AdminAuditLogSummary } from '@afrows/shared';
import { fetchAdminAuditLogs } from '../api/admin';
import { DataTable, PanelHeadingContent, PanelState, StatusBadge } from '../components/primitives';
import type { DataState, DataTableColumn } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { fieldInputClass, fieldLabelClass, mutedTextClass, panelClass, primaryButtonClass } from '../ui-classes';

type AuditLogFilterState = {
  action: string;
  targetType: string;
};

export function AuditLogsPage({
  format,
  sessionToken,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogSummary[]>([]);
  const [filters, setFilters] = useState<AuditLogFilterState>({ action: '', targetType: '' });
  const [draftFilters, setDraftFilters] = useState<AuditLogFilterState>({ action: '', targetType: '' });
  const [dataState, setDataState] = useState<DataState>('loading');
  const [error, setError] = useState<string | null>(null);

  const loadAuditLogs = useMemo(() => async (signal?: AbortSignal) => {
    setDataState('loading');
    setError(null);

    try {
      const response = await fetchAdminAuditLogs(sessionToken, {
        action: filters.action || undefined,
        limit: 100,
        targetType: filters.targetType || undefined,
      }, signal);

      setAuditLogs(response.auditLogs);
      setDataState('live');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

      setError(t.auditLogs.errors.load);
      setDataState((current) => (current === 'live' || current === 'stale' ? 'stale' : 'fallback'));
    }
  }, [filters, sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAuditLogs(controller.signal);

    return () => controller.abort();
  }, [loadAuditLogs]);

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({
      action: draftFilters.action.trim(),
      targetType: draftFilters.targetType.trim(),
    });
  };

  const actorTypeCount = new Set(auditLogs.map((log) => log.actorType)).size;
  const targetTypeCount = new Set(auditLogs.map((log) => log.targetType).filter(Boolean)).size;
  const latestEvent = auditLogs[0]?.createdAt ? format.dateTime(new Date(auditLogs[0].createdAt)) : t.auditLogs.none;
  const auditLogColumns: Array<DataTableColumn<AdminAuditLogSummary>> = [
    {
      key: 'time',
      header: t.auditLogs.time,
      render: (log) => format.dateTime(new Date(log.createdAt)),
    },
    {
      key: 'actor',
      header: t.auditLogs.actor,
      render: (log) => (
        <>
          <strong className="block text-afro-ink">{log.actorType}</strong>
          <span className="font-mono text-[12px] text-afro-muted">{shortenAuditId(log.actorId) ?? t.auditLogs.none}</span>
        </>
      ),
    },
    {
      key: 'action',
      header: t.auditLogs.action,
      render: (log) => <span className="font-mono text-[12px] text-afro-ink">{log.action}</span>,
    },
    {
      key: 'target',
      header: t.auditLogs.target,
      render: (log) => (
        <>
          <strong className="block text-afro-ink">{log.targetType ?? t.auditLogs.none}</strong>
          <span className="font-mono text-[12px] text-afro-muted">{shortenAuditId(log.targetId) ?? t.auditLogs.none}</span>
        </>
      ),
    },
    {
      key: 'metadata',
      header: t.auditLogs.metadata,
      render: (log) => (
        <code className="block max-w-[360px] truncate rounded-md border border-afro-line bg-[#f8fafb] px-2 py-1 text-[12px] text-afro-muted" title={formatAuditMetadata(log.metadata, t.auditLogs.none)}>
          {formatAuditMetadata(log.metadata, t.auditLogs.none)}
        </code>
      ),
    },
  ];

  return (
    <section className="mt-0 grid gap-3">
      <section className="grid gap-2 md:grid-cols-4">
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.eventsShown}</span>
          <strong className="mt-1 block text-[22px] leading-tight text-afro-ink">{format.integer(auditLogs.length)}</strong>
        </div>
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.actorTypes}</span>
          <strong className="mt-1 block text-[22px] leading-tight text-afro-ink">{format.integer(actorTypeCount)}</strong>
        </div>
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.targetTypes}</span>
          <strong className="mt-1 block text-[22px] leading-tight text-afro-ink">{format.integer(targetTypeCount)}</strong>
        </div>
        <div className={panelClass}>
          <span className={mutedTextClass}>{t.auditLogs.latestEvent}</span>
          <strong className="mt-1 block truncate text-[15px] leading-tight text-afro-ink" title={latestEvent}>{latestEvent}</strong>
        </div>
      </section>

      <section className={panelClass}>
        <form className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_auto] md:items-end" onSubmit={handleFilterSubmit}>
          <label className={fieldLabelClass}>
            <span>{t.auditLogs.actionFilter}</span>
            <input
              className={fieldInputClass}
              onChange={(event) => setDraftFilters((current) => ({ ...current, action: event.target.value }))}
              placeholder={t.auditLogs.allActions}
              type="text"
              value={draftFilters.action}
            />
          </label>
          <label className={fieldLabelClass}>
            <span>{t.auditLogs.targetTypeFilter}</span>
            <input
              className={fieldInputClass}
              onChange={(event) => setDraftFilters((current) => ({ ...current, targetType: event.target.value }))}
              placeholder={t.auditLogs.allTargets}
              type="text"
              value={draftFilters.targetType}
            />
          </label>
          <button className={primaryButtonClass} type="submit">
            {t.auditLogs.refresh}
          </button>
        </form>
      </section>

      <section className={panelClass}>
        <div className="flex min-h-9 flex-col gap-2 border-b border-afro-line pb-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelHeadingContent
            title={t.auditLogs.title}
            meta={dataState === 'loading' ? t.dataStatus.loading : t.auditLogs.eventsLoaded(format.integer(auditLogs.length))}
          />
          <StatusBadge tone={dataState === 'live' ? 'good' : dataState === 'stale' ? 'warning' : 'neutral'}>
            {dataState === 'live' ? t.dataStatus.live : dataState === 'stale' ? t.dataStatus.stale : dataState === 'loading' ? t.dataStatus.loading : t.dataStatus.fallback}
          </StatusBadge>
        </div>

        <div className="mt-2 grid gap-2">
          {error ? <PanelState detail={error} kind="error" title={t.panelStates.errorTitle} /> : null}
          {dataState === 'loading' && auditLogs.length === 0 ? (
            <PanelState detail={t.panelStates.loadingDetail} kind="loading" title={t.panelStates.loadingTitle} />
          ) : null}
          {dataState !== 'loading' && auditLogs.length === 0 && !error ? (
            <PanelState detail={t.panelStates.emptyDetail} kind="empty" title={t.auditLogs.noEvents} />
          ) : null}
          {auditLogs.length > 0 ? <DataTable columns={auditLogColumns} minWidth="860px" rowKey={(log) => log.id} rows={auditLogs} /> : null}
        </div>
      </section>
    </section>
  );
}

function shortenAuditId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 28) return value;

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatAuditMetadata(metadata: Record<string, unknown>, emptyLabel: string): string {
  const serialized = JSON.stringify(metadata);
  if (!serialized || serialized === '{}') return emptyLabel;
  if (serialized.length <= 240) return serialized;

  return `${serialized.slice(0, 240)}...`;
}
