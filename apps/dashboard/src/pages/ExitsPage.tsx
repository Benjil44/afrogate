import { useState } from 'react';
import type { AdminSessionResponse, AdminTunnelSummary } from '@afrows/shared';
import { DashboardTabs } from '../components/primitives';
import type { DashboardTabItem, DataState, ExitsTab, OutboundRowData, RouteFailoverRowData, TunnelRowData } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { OutboundsPage } from './OutboundsPage';
import { RoutesPage } from './RoutesPage';
import { MicrotiksPage } from './MicrotiksPage';
import { RouteSettingsPanel } from '../components/route-settings-panel';

export function ExitsPage({
  dataState,
  failoverRows,
  format,
  outbounds,
  session,
  sessionToken,
  tunnelDataState,
  tunnelSummaries,
  tunnels,
  t,
}: {
  dataState: DataState;
  failoverRows: RouteFailoverRowData[];
  format: DashboardFormatters;
  outbounds: OutboundRowData[];
  session: AdminSessionResponse;
  sessionToken: string;
  tunnelDataState: DataState;
  tunnelSummaries: AdminTunnelSummary[];
  tunnels: TunnelRowData[];
  t: DashboardStrings;
}) {
  const [activeTab, setActiveTab] = useState<ExitsTab>('egress');

  const tabs: Array<DashboardTabItem<ExitsTab>> = [
    { id: 'egress', label: t.tabs.exitsEgress },
    { id: 'routing', label: t.tabs.exitsRouting },
    { id: 'sources', label: t.tabs.exitsSources },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DashboardTabs activeTab={activeTab} ariaLabel={t.tabs.exitsSections} onChange={setActiveTab} tabs={tabs} />
      {activeTab === 'egress' ? <OutboundsPage sessionToken={sessionToken} t={t} /> : null}
      {activeTab === 'routing' ? (
        <div className="flex flex-col gap-4">
          <RouteSettingsPanel format={format} session={session} sessionToken={sessionToken} t={t} />
          <RoutesPage
            dataState={dataState}
            failoverRows={failoverRows}
            format={format}
            outbounds={outbounds}
            session={session}
            sessionToken={sessionToken}
            tunnelDataState={tunnelDataState}
            tunnelSummaries={tunnelSummaries}
            tunnels={tunnels}
            t={t}
          />
        </div>
      ) : null}
      {activeTab === 'sources' ? <MicrotiksPage roleFilter="transport" sessionToken={sessionToken} t={t} /> : null}
    </div>
  );
}
