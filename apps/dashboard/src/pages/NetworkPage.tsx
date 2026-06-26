import { useState } from 'react';
import { DashboardTabs } from '../components/primitives';
import type { DashboardTabItem, NetworkTab } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { NetworkMap } from '../components/network-map';
import { InboundsPage } from './InboundsPage';
import { ConnectionsPage } from './ConnectionsPage';

export function NetworkPage({
  format,
  sessionToken,
  onOpenExits,
  t,
}: {
  format: DashboardFormatters;
  sessionToken: string;
  onOpenExits: () => void;
  t: DashboardStrings;
}) {
  const [tab, setTab] = useState<NetworkTab>('map');
  const tabs: Array<DashboardTabItem<NetworkTab>> = [
    { id: 'map', label: t.tabs.networkMap },
    { id: 'inbounds', label: t.tabs.networkInbounds },
    { id: 'connections', label: t.tabs.networkConnections },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DashboardTabs activeTab={tab} ariaLabel={t.tabs.networkSections} onChange={setTab} tabs={tabs} />
      {tab === 'map' ? (
        <NetworkMap sessionToken={sessionToken} t={t} onOpenExits={onOpenExits} onOpenInbounds={() => setTab('inbounds')} />
      ) : null}
      {tab === 'inbounds' ? <InboundsPage format={format} sessionToken={sessionToken} t={t} /> : null}
      {tab === 'connections' ? <ConnectionsPage format={format} sessionToken={sessionToken} t={t} /> : null}
    </div>
  );
}
