import type { CSSProperties } from 'react';
import { Activity, Bell, Gauge, Route, Server, ShieldCheck } from 'lucide-react';

const summary = [
  { label: 'Active users', value: '150', tone: 'neutral' },
  { label: 'Outbound', value: '20 MB/s', tone: 'good' },
  { label: 'Critical alerts', value: '0', tone: 'good' },
  { label: 'Lowest storage', value: '64%', tone: 'neutral' },
];

const servers = [
  { name: 'Iran Edge 01', country: 'IR', cpu: 38, ram: 51, disk: 64, score: 94 },
  { name: 'Iran Edge 02', country: 'IR', cpu: 44, ram: 58, disk: 71, score: 91 },
  { name: 'Germany Core 01', country: 'DE', cpu: 29, ram: 47, disk: 82, score: 96 },
];

const tunnels = [
  { name: 'wg1', operator: 'Mobinnet', ping: 46, jitter: 8, loss: 0.1, score: 95 },
  { name: 'wireguard2', operator: 'Irancell', ping: 62, jitter: 14, loss: 0.3, score: 86 },
  { name: 'wireguard3', operator: 'Irancell', ping: 58, jitter: 11, loss: 0.2, score: 89 },
];

export function DashboardApp() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={22} />
          <span>AfroGate</span>
        </div>
        <nav className="nav">
          <a className="active" href="#dashboard"><Activity size={18} />Dashboard</a>
          <a href="#servers"><Server size={18} />Servers</a>
          <a href="#routes"><Route size={18} />Routes</a>
          <a href="#alerts"><Bell size={18} />Alerts</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Network health dashboard</h1>
          </div>
          <div className="status-pill">
            <span className="dot" />
            Live
          </div>
        </header>

        <section className="summary-grid" aria-label="Summary">
          {summary.map((item) => (
            <div className={`metric ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading">
              <h2>Servers</h2>
              <Gauge size={18} />
            </div>
            <div className="server-list">
              {servers.map((server) => (
                <div className="server-row" key={server.name}>
                  <div>
                    <strong>{server.name}</strong>
                    <span>{server.country}</span>
                  </div>
                  <div className="bars">
                    <span style={{ '--value': server.cpu } as CSSProperties}>CPU {server.cpu}%</span>
                    <span style={{ '--value': server.ram } as CSSProperties}>RAM {server.ram}%</span>
                    <span style={{ '--value': 100 - server.disk } as CSSProperties}>
                      Disk free {server.disk}%
                    </span>
                  </div>
                  <b>{server.score}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <h2>Tunnels</h2>
              <Route size={18} />
            </div>
            <table>
              <thead>
                <tr>
                  <th>Tunnel</th>
                  <th>Operator</th>
                  <th>Ping</th>
                  <th>Jitter</th>
                  <th>Loss</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {tunnels.map((tunnel) => (
                  <tr key={tunnel.name}>
                    <td>{tunnel.name}</td>
                    <td>{tunnel.operator}</td>
                    <td>{tunnel.ping} ms</td>
                    <td>{tunnel.jitter} ms</td>
                    <td>{tunnel.loss}%</td>
                    <td><strong>{tunnel.score}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

