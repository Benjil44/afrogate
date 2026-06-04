import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Clock, Route, ScrollText, Server } from 'lucide-react';
import type { AdminIncidentTimelineResponse } from '@afrows/shared';
import { fetchAdminAlerts, fetchIncidentTimeline } from '../api/admin';
import { DataStateEmpty, DataStateNotice, DataTable, MetricPill, PanelHeading, StatusBadge } from '../components/primitives';
import type { AlertRowData, AlertSeverityFilter, AlertStatusFilter, DataState, DataTableColumn, Tone } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { countActiveAlertRows, incidentTimelineEventDetail, incidentTimelineEventTitle, incidentTimelineKindLabel, incidentTimelineSeverityTone, mapAdminAlertsToRows } from '../mappers';
import { mutedTextClass, panelClass } from '../ui-classes';

function IncidentTimelinePanel({
  dataState,
  format,
  timeline,
  t,
}: {
  dataState: DataState;
  format: DashboardFormatters;
  timeline: AdminIncidentTimelineResponse | null;
  t: DashboardStrings;
}) {
  const events = timeline?.events ?? [];
  const meta = timeline ? t.incidentTimeline.events(format.integer(events.length)) : t.incidentTimeline.learning;

  return (
    <section className={panelClass}>
      <PanelHeading title={t.panels.incidentTimeline} icon={ScrollText} meta={meta} />
      <div className="mt-2 grid gap-2">
        {events.length > 0 && dataState !== 'live' ? <DataStateNotice state={dataState} t={t} /> : null}
        {events.length === 0 ? (
          <DataStateEmpty emptyMessage={t.incidentTimeline.noEvents} state={dataState} t={t} />
        ) : null}
        {events.slice(0, 8).map((event) => (
          <div className="grid min-h-[58px] gap-2 rounded-md border border-afro-line p-2" key={event.id}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate text-[13px]" title={incidentTimelineEventTitle(event, t)}>
                  {incidentTimelineEventTitle(event, t)}
                </strong>
                <span className={`${mutedTextClass} block truncate`} title={incidentTimelineEventDetail(event, format, t)}>
                  {incidentTimelineEventDetail(event, format, t)}
                </span>
              </div>
              <StatusBadge tone={incidentTimelineSeverityTone(event.severity)}>
                {incidentTimelineKindLabel(event.kind, t)}
              </StatusBadge>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <MetricPill icon={Clock} label={t.incidentTimeline.occurredAt} value={format.time(new Date(event.occurredAt), false)} />
              {event.routeGroup ? (
                <MetricPill icon={Route} label={t.incidentTimeline.routeGroup} value={format.label(event.routeGroup)} />
              ) : null}
              {event.sourceLabel ? (
                <MetricPill icon={Server} label={t.tables.source} value={format.label(event.sourceLabel)} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AlertsPage({
  alerts,
  dataState,
  format,
  sessionToken,
  t,
}: {
  alerts: AlertRowData[];
  dataState: DataState;
  format: DashboardFormatters;
  sessionToken: string;
  t: DashboardStrings;
}) {
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>('open');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [resolvedAlerts, setResolvedAlerts] = useState<AlertRowData[]>([]);
  const [resolvedDataState, setResolvedDataState] = useState<DataState>('loading');
  const [incidentTimeline, setIncidentTimeline] = useState<AdminIncidentTimelineResponse | null>(null);
  const [incidentTimelineState, setIncidentTimelineState] = useState<DataState>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setResolvedDataState('loading');

    void fetchAdminAlerts(sessionToken, { limit: 100, status: 'resolved' }, controller.signal)
      .then((response) => {
        setResolvedAlerts(mapAdminAlertsToRows(response.alerts, t));
        setResolvedDataState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setResolvedDataState('fallback');
      });

    return () => controller.abort();
  }, [sessionToken, t]);

  useEffect(() => {
    const controller = new AbortController();
    setIncidentTimelineState('loading');

    void fetchIncidentTimeline(sessionToken, 24, 100, controller.signal)
      .then((response) => {
        setIncidentTimeline(response);
        setIncidentTimelineState('live');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setIncidentTimelineState((current) => (current === 'live' ? 'stale' : 'fallback'));
      });

    return () => controller.abort();
  }, [sessionToken]);

  const currentAlerts = statusFilter === 'open' ? alerts : resolvedAlerts;
  const currentDataState = statusFilter === 'open' ? dataState : resolvedDataState;
  const sourceOptions = useMemo(
    () => Array.from(new Set(currentAlerts.map((alert) => alert.source).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [currentAlerts],
  );
  const filteredAlerts = useMemo(
    () => currentAlerts.filter((alert) => (
      (severityFilter === 'all' || alert.severity === severityFilter)
        && (sourceFilter === 'all' || alert.source === sourceFilter)
    )),
    [currentAlerts, severityFilter, sourceFilter],
  );
  const activeAlertCount = countActiveAlertRows(filteredAlerts);
  const alertColumns: Array<DataTableColumn<AlertRowData>> = [
    {
      key: 'severity',
      header: t.tables.severity,
      render: (alert) => <StatusBadge tone={alert.severity}>{t.status[alert.severity]}</StatusBadge>,
    },
    { key: 'source', header: t.tables.source, render: (alert) => format.label(alert.source) },
    {
      key: 'alert',
      header: t.tables.alert,
      render: (alert) => (
        <>
          <strong className="block max-w-[420px] truncate text-afro-ink" title={alert.title}>{alert.title}</strong>
          {alert.message ? <span className="block max-w-[420px] truncate text-[12px]" title={alert.message}>{alert.message}</span> : null}
        </>
      ),
    },
    { key: 'status', header: t.tables.status, render: (alert) => format.label(alert.status ?? statusFilter) },
    {
      key: 'lastSeen',
      header: t.tables.lastSeen,
      render: (alert) => {
        const timestamp = alert.status === 'resolved' && alert.resolvedAt ? alert.resolvedAt : alert.lastSeenAt;

        return timestamp ? format.time(new Date(timestamp), false) : '-';
      },
    },
  ];

  useEffect(() => {
    if (sourceFilter !== 'all' && !sourceOptions.includes(sourceFilter)) {
      setSourceFilter('all');
    }
  }, [sourceFilter, sourceOptions]);

  return (
    <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className={panelClass}>
        <PanelHeading
          title={statusFilter === 'open' ? t.panels.openAlerts : t.panels.alertHistory}
          icon={AlertTriangle}
          meta={t.panels.visible(format.integer(activeAlertCount))}
        />
        <div className="mt-2 grid gap-2 rounded-md border border-afro-line bg-[#f9fbfc] p-2 sm:grid-cols-[minmax(180px,0.8fr)_minmax(150px,0.6fr)_minmax(170px,0.8fr)]">
          <div className="grid gap-1">
            <span className={mutedTextClass}>{t.alertFilters.status}</span>
            <div className="inline-grid grid-cols-2 rounded-md border border-afro-line bg-white p-1">
              {(['open', 'resolved'] as AlertStatusFilter[]).map((status) => {
                const isActive = statusFilter === status;
                const activeClass = isActive ? 'bg-afro-sidebar text-white shadow-sm' : 'text-afro-muted hover:text-afro-ink';

                return (
                  <button
                    className={`min-h-8 rounded px-2 text-[12px] font-bold ${activeClass}`}
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    title={status === 'open' ? t.alertFilters.open : t.alertFilters.resolved}
                    type="button"
                  >
                    {status === 'open' ? t.alertFilters.open : t.alertFilters.resolved}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="grid gap-1">
            <span className={mutedTextClass}>{t.alertFilters.severity}</span>
            <select
              aria-label={t.alertFilters.severity}
              className="min-h-10 rounded-md border border-afro-line bg-white px-2 text-[13px] font-bold text-afro-ink outline-none focus:border-afro-teal"
              onChange={(event) => setSeverityFilter(event.target.value as AlertSeverityFilter)}
              value={severityFilter}
            >
              <option value="all">{t.alertFilters.allSeverities}</option>
              {(['critical', 'warning', 'neutral', 'good'] as Tone[]).map((severity) => (
                <option key={severity} value={severity}>{t.status[severity]}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className={mutedTextClass}>{t.alertFilters.source}</span>
            <select
              aria-label={t.alertFilters.source}
              className="min-h-10 rounded-md border border-afro-line bg-white px-2 text-[13px] font-bold text-afro-ink outline-none focus:border-afro-teal"
              onChange={(event) => setSourceFilter(event.target.value)}
              value={sourceFilter}
            >
              <option value="all">{t.alertFilters.allSources}</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>{format.label(source)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 grid gap-2">
          {filteredAlerts.length > 0 && currentDataState !== 'live' ? <DataStateNotice state={currentDataState} t={t} /> : null}
          {filteredAlerts.length === 0 ? (
            <DataStateEmpty
              emptyMessage={statusFilter === 'open' ? t.alerts.noOpenAlerts : t.alerts.noResolvedAlerts}
              state={currentDataState}
              t={t}
            />
          ) : null}
          {filteredAlerts.length > 0 ? (
            <DataTable columns={alertColumns} minWidth="760px" rowKey={(alert) => alert.id} rows={filteredAlerts} />
          ) : null}
        </div>
      </section>

      <div className="grid gap-3">
        <IncidentTimelinePanel dataState={incidentTimelineState} format={format} timeline={incidentTimeline} t={t} />

        <section className={panelClass}>
          <PanelHeading title={t.panels.alertRules} icon={Bell} meta={t.panels.mvpThresholds} />
          <div className="mt-2 grid gap-2">
            {([
              [t.alertRules.storage, format.percentThreshold('<', 10), 'critical'],
              [t.alertRules.healthScore, format.numberThreshold('<', 60), 'warning'],
              [t.alertRules.ping, format.latencyThreshold('>', 150), 'warning'],
              [t.alertRules.packetLoss, format.percentThreshold('>', 1), 'critical'],
            ] as Array<[string, string, Tone]>).map(([label, value, tone]) => (
              <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-afro-line px-2.5" key={label}>
                <span className={`${mutedTextClass} min-w-0 truncate`}>{label}</span>
                <StatusBadge tone={tone}>{value}</StatusBadge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
