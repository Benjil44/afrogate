import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { Activity, Bell, Gauge, Route, Server, ShieldCheck } from 'lucide-react';

type Tone = 'good' | 'neutral';

interface MetricCardData {
  label: string;
  value: string;
  tone: Tone;
}

interface ServerRowData {
  name: string;
  country: string;
  cpu: number;
  ram: number;
  disk: number;
  score: number;
}

interface TunnelRowData {
  name: string;
  operator: string;
  ping: number;
  jitter: number;
  loss: number;
  score: number;
}

interface NavItemData {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const summary: MetricCardData[] = [
  { label: 'Active users', value: '150', tone: 'neutral' },
  { label: 'Outbound', value: '20 MB/s', tone: 'good' },
  { label: 'Critical alerts', value: '0', tone: 'good' },
  { label: 'Lowest storage', value: '64%', tone: 'neutral' },
];

const servers: ServerRowData[] = [
  { name: 'Iran Edge 01', country: 'IR', cpu: 38, ram: 51, disk: 64, score: 94 },
  { name: 'Iran Edge 02', country: 'IR', cpu: 44, ram: 58, disk: 71, score: 91 },
  { name: 'Germany Core 01', country: 'DE', cpu: 29, ram: 47, disk: 82, score: 96 },
];

const tunnels: TunnelRowData[] = [
  { name: 'wg1', operator: 'Mobinnet', ping: 46, jitter: 8, loss: 0.1, score: 95 },
  { name: 'wireguard2', operator: 'Irancell', ping: 62, jitter: 14, loss: 0.3, score: 86 },
  { name: 'wireguard3', operator: 'Irancell', ping: 58, jitter: 11, loss: 0.2, score: 89 },
];

const navItems: NavItemData[] = [
  { href: '#dashboard', label: 'Dashboard', icon: Activity },
  { href: '#servers', label: 'Servers', icon: Server },
  { href: '#routes', label: 'Routes', icon: Route },
  { href: '#alerts', label: 'Alerts', icon: Bell },
];

const panelClass = 'min-w-0 rounded-lg border border-afro-line bg-afro-panel p-[18px]';
const mutedTextClass = 'text-[13px] text-afro-muted';

export function DashboardApp() {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-afro-page text-afro-ink lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar />

      <section className="min-w-0 p-[18px] md:p-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1.5 text-[13px] font-bold uppercase text-afro-teal">Operations</p>
            <h1 className="text-[28px] leading-tight font-bold">Network health dashboard</h1>
          </div>
          <div className="inline-flex min-h-[34px] w-fit items-center gap-2 rounded-full border border-[#b8e1cf] bg-[#e7f6ef] px-3 text-sm font-bold text-afro-green">
            <span className="size-2 rounded-full bg-afro-green" />
            Live
          </div>
        </header>

        <section className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
          {summary.map((item) => (
            <MetricCard item={item} key={item.label} />
          ))}
        </section>

        <section className="mt-[18px] grid gap-[18px] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ServerPanel />
          <TunnelPanel />
        </section>
      </section>
    </main>
  );
}

function Sidebar() {
  return (
    <aside className="bg-afro-sidebar px-[18px] py-4 text-[#eef6f4] md:py-6">
      <div className="flex h-10 items-center gap-2.5 text-xl font-bold">
        <ShieldCheck size={22} />
        <span>AfroGate</span>
      </div>
      <nav className="mt-4 grid auto-cols-max grid-flow-col gap-1.5 overflow-x-auto lg:mt-8 lg:grid-flow-row">
        {navItems.map((item, index) => (
          <NavItem item={item} isActive={index === 0} key={item.href} />
        ))}
      </nav>
    </aside>
  );
}

function NavItem({ item, isActive }: { item: NavItemData; isActive: boolean }) {
  const Icon = item.icon;
  const activeClass = isActive ? 'bg-[#1f3138] text-white' : 'text-[#c8d7d5] hover:bg-[#1f3138] hover:text-white';

  return (
    <a className={`flex min-h-10 items-center gap-2.5 rounded-md px-3 ${activeClass}`} href={item.href}>
      <Icon size={18} />
      {item.label}
    </a>
  );
}

function MetricCard({ item }: { item: MetricCardData }) {
  const toneClass = item.tone === 'good' ? 'border-t-afro-green' : 'border-t-afro-blue';

  return (
    <div className={`grid min-h-24 gap-2 rounded-lg border border-t-4 border-afro-line bg-afro-panel p-[18px] ${toneClass}`}>
      <span className="text-sm text-afro-muted">{item.label}</span>
      <strong className="text-[26px] leading-tight">{item.value}</strong>
    </div>
  );
}

function ServerPanel() {
  return (
    <section className={panelClass}>
      <PanelHeading title="Servers" icon={Gauge} />
      <div className="mt-3.5 grid gap-3">
        {servers.map((server) => (
          <ServerRow server={server} key={server.name} />
        ))}
      </div>
    </section>
  );
}

function ServerRow({ server }: { server: ServerRowData }) {
  return (
    <div className="grid min-h-[86px] items-center gap-3.5 rounded-md border border-afro-line p-3 sm:grid-cols-[150px_1fr_48px]">
      <div className="grid gap-1">
        <strong>{server.name}</strong>
        <span className={mutedTextClass}>{server.country}</span>
      </div>
      <div className="grid gap-[7px]">
        <UsageBar label="CPU" value={server.cpu} />
        <UsageBar label="RAM" value={server.ram} />
        <UsageBar label="Disk free" value={server.disk} invert />
      </div>
      <b className="text-left text-[22px] text-afro-green sm:text-right">{server.score}</b>
    </div>
  );
}

function UsageBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const fillValue = invert ? 100 - value : value;

  return (
    <span
      className="min-h-[22px] rounded-full px-2.5 py-1 text-[13px] text-[#243238]"
      style={{
        background: `linear-gradient(90deg, #a9d8d1 ${fillValue}%, #edf2f4 0)`,
      } as CSSProperties}
    >
      {label} {value}%
    </span>
  );
}

function TunnelPanel() {
  return (
    <section className={panelClass}>
      <PanelHeading title="Tunnels" icon={Route} />
      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Tunnel', 'Operator', 'Ping', 'Jitter', 'Loss', 'Score'].map((heading) => (
                <th className="border-b border-afro-line px-2 py-[13px] text-left text-[13px] font-bold text-afro-muted last:pr-0 last:text-right first:pl-0" key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tunnels.map((tunnel) => (
              <tr key={tunnel.name}>
                <TableCell>{tunnel.name}</TableCell>
                <TableCell>{tunnel.operator}</TableCell>
                <TableCell>{tunnel.ping} ms</TableCell>
                <TableCell>{tunnel.jitter} ms</TableCell>
                <TableCell>{tunnel.loss}%</TableCell>
                <TableCell alignRight>
                  <strong className="text-afro-ink">{tunnel.score}</strong>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelHeading({ title, icon: Icon }: { title: string; icon: ComponentType<{ size?: number }> }) {
  return (
    <div className="flex items-center justify-between border-b border-afro-line pb-3.5">
      <h2 className="text-[17px] font-bold">{title}</h2>
      <Icon size={18} />
    </div>
  );
}

function TableCell({ children, alignRight = false }: { children: ReactNode; alignRight?: boolean }) {
  const alignmentClass = alignRight ? 'text-right' : 'text-left';

  return (
    <td className={`border-b border-afro-line px-2 py-[13px] text-[13px] text-afro-muted first:pl-0 last:pr-0 ${alignmentClass}`}>
      {children}
    </td>
  );
}
