import { DashboardTabs } from '../components/primitives';
import type { DashboardTabItem, NetworkTab } from '../dashboard-types';
import type { DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { NetworkMap } from '../components/network-map';
import { InboundsPage } from './InboundsPage';
import { ConnectionsPage } from './ConnectionsPage';

const NETWORK_TABS: NetworkTab[] = ['map', 'inbounds', 'connections'];

export function NetworkPage({
  activeTab,
  format,
  onTabChange,
  sessionToken,
  onOpenExits,
  t,
}: {
  /** Canonical `?tab=` search param from the router (null falls back to map). */
  activeTab: string | null;
  format: DashboardFormatters;
  onTabChange: (tab: string) => void;
  sessionToken: string;
  onOpenExits: () => void;
  t: DashboardStrings;
}) {
  // Tab lives in the URL (?tab=) so refresh + deep links keep the section.
  const tab: NetworkTab = NETWORK_TABS.includes(activeTab as NetworkTab) ? (activeTab as NetworkTab) : 'map';
  const tabs: Array<DashboardTabItem<NetworkTab>> = [
    { id: 'map', label: t.tabs.networkMap },
    { id: 'inbounds', label: t.tabs.networkInbounds },
    { id: 'connections', label: t.tabs.networkConnections },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DashboardTabs activeTab={tab} ariaLabel={t.tabs.networkSections} onChange={onTabChange} tabs={tabs} />
      {tab === 'map' ? (
        <NetworkMap sessionToken={sessionToken} t={t} onOpenExits={onOpenExits} onOpenInbounds={() => onTabChange('inbounds')} />
      ) : null}
      {tab === 'inbounds' ? <InboundsPage format={format} sessionToken={sessionToken} t={t} /> : null}
      {tab === 'connections' ? <ConnectionsPage format={format} sessionToken={sessionToken} t={t} /> : null}
    </div>
  );
}
