import { Cpu, Download, HardDrive, MemoryStick, Upload } from 'lucide-react';
import type { AfroIcon, ServerRowData, Tone, TrafficTotals } from '../dashboard-types';
import { averagePercent, type DashboardFormatters } from '../formatters';
import type { DashboardStrings } from '../i18n';
import { getStorageTone, getUsageTone } from '../tone';
import { mutedTextClass } from '../ui-classes';
import { StatusBadge } from './primitives';

export function SystemResourceHeader({
  format,
  servers,
  t,
  trafficTotals,
}: {
  format: DashboardFormatters;
  servers: ServerRowData[];
  t: DashboardStrings;
  trafficTotals: TrafficTotals;
}) {
  const cpuAverage = averagePercent(servers.map((server) => server.cpu));
  const ramAverage = averagePercent(servers.map((server) => server.ram));
  const storages = servers.flatMap((server) =>
    server.storages.map((storage) => ({
      ...storage,
      serverName: server.name,
    })),
  );
  const lowestStorage = storages.reduce<number | null>((lowest, storage) => {
    if (typeof storage.freePercent !== 'number') return lowest;
    return lowest === null ? storage.freePercent : Math.min(lowest, storage.freePercent);
  }, null);

  return (
    <section className="mt-2.5" aria-label={t.aria.systemResources}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5 xl:gap-2">
        <ResourceStat icon={Cpu} label={t.resources.cpuAverage} tone={getUsageTone(cpuAverage)} value={format.percent(cpuAverage)} />
        <ResourceStat icon={MemoryStick} label={t.resources.ramAverage} tone={getUsageTone(ramAverage)} value={format.percent(ramAverage)} />
        <ResourceStat icon={HardDrive} label={t.resources.lowestStorage} tone={getStorageTone(lowestStorage)} value={format.percent(lowestStorage)} />
        <ResourceStat icon={Download} label={t.resources.download} tone="neutral" value={format.bytesPerSecond(trafficTotals.downloadBps)} />
        <ResourceStat icon={Upload} label={t.resources.upload} tone="neutral" value={format.bytesPerSecond(trafficTotals.uploadBps)} />
      </div>

      <div className="mt-2 overflow-x-auto rounded-md border border-afro-line bg-afro-panel">
        <div className="grid auto-cols-[minmax(138px,1fr)] grid-flow-col gap-1.5 p-1.5 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 xl:grid-cols-3">
          {storages.map((storage) => {
            const serverName = format.label(storage.serverName);
            const freePercent = format.percent(storage.freePercent ?? null);
            const storageTooltip = `${serverName} ${storage.path} ${freePercent}`;

            return (
              <div
                aria-label={storageTooltip}
                className="min-w-0 rounded-md border border-afro-line px-2 py-1"
                key={`${storage.serverName}-${storage.path}`}
                title={storageTooltip}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="min-w-0 truncate text-[13px]" title={serverName}>{serverName}</strong>
                  <StatusBadge title={freePercent} tone={getStorageTone(storage.freePercent ?? null)}>
                    {freePercent}
                  </StatusBadge>
                </div>
                <div className={`${mutedTextClass} truncate`} title={storage.path}>{storage.path}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResourceStat({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: AfroIcon;
  label: string;
  tone: Tone;
  value: string;
}) {
  const borderClass = {
    good: 'border-t-afro-green',
    neutral: 'border-t-afro-blue',
    warning: 'border-t-[#c27a1a]',
    critical: 'border-t-[#b91c1c]',
  }[tone];
  const tooltip = `${label} ${value}`;

  return (
    <div
      aria-label={tooltip}
      className={`grid min-h-[50px] gap-0.5 rounded-md border border-t-[3px] border-afro-line bg-afro-panel px-2 py-1.5 sm:min-h-[54px] sm:gap-1 sm:border-t-4 sm:p-2 ${borderClass}`}
      title={tooltip}
    >
      <div className="flex min-w-0 items-center justify-between gap-1.5">
        <span className="min-w-0 truncate text-[11px] text-afro-muted sm:text-[12px]" title={label}>{label}</span>
        <Icon className="shrink-0" size={15} />
      </div>
      <strong className="min-w-0 truncate text-[15px] leading-tight sm:text-[17px]" title={value}>{value}</strong>
    </div>
  );
}
