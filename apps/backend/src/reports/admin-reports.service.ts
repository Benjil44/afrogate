import { Injectable } from '@nestjs/common';
import type {
  AdminAlertSummary,
  AdminBackupStatusSummary,
  AdminOutboundSummary,
  AdminReportAlertSummary,
  AdminReportBackupSummary,
  AdminReportOutboundSummary,
  AdminReportsSummaryResponse,
  AdminReportServerSummary,
  AdminRouteQualityAnalyticsResponse,
  AdminServerSummary,
} from '@afrows/shared';
import { BackupStatusService } from '../backups/backup-status.service';
import { OperationsService } from '../operations/operations.service';

@Injectable()
export class AdminReportsService {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly backupStatusService: BackupStatusService,
  ) {}

  async getSummary(rangeHours: number): Promise<AdminReportsSummaryResponse> {
    const [servers, outbounds, alerts, backups, routeQuality] = await Promise.all([
      this.operationsService.listServers(),
      this.operationsService.listOutbounds({ limit: 500 }),
      this.operationsService.listAlerts({ status: 'open', limit: 500 }),
      this.backupStatusService.getStatus(),
      this.operationsService.getRouteQualityAnalytics('main', rangeHours),
    ]);
    const serverSummary = this.summarizeServers(servers);
    const outboundSummary = this.summarizeOutbounds(outbounds);
    const alertSummary = this.summarizeAlerts(alerts);
    const backupSummary = this.summarizeBackups(backups);
    const routeQualitySummary = this.summarizeRouteQuality(routeQuality);
    const { riskLevel, riskScore, reasonCodes } = this.scoreRisk({
      alerts: alertSummary,
      backups: backupSummary,
      outbounds: outboundSummary,
      routeQuality: routeQualitySummary,
      servers: serverSummary,
    });

    return {
      generatedAt: new Date().toISOString(),
      rangeHours,
      riskLevel,
      riskScore,
      reasonCodes,
      servers: serverSummary,
      outbounds: outboundSummary,
      alerts: alertSummary,
      backups: backupSummary,
      routeQuality: routeQualitySummary,
    };
  }

  private summarizeServers(servers: AdminServerSummary[]): AdminReportServerSummary {
    return servers.reduce<AdminReportServerSummary>((summary, server) => {
      summary.total += 1;
      const status = this.normalizeStatus(server.status);
      if (status === 'healthy') summary.healthy += 1;
      else if (status === 'critical') summary.critical += 1;
      else if (status === 'degraded') summary.degraded += 1;
      else summary.unknown += 1;

      return summary;
    }, { critical: 0, degraded: 0, healthy: 0, total: 0, unknown: 0 });
  }

  private summarizeOutbounds(outbounds: AdminOutboundSummary[]): AdminReportOutboundSummary {
    return outbounds.reduce<AdminReportOutboundSummary>((summary, outbound) => {
      summary.total += 1;
      if (!outbound.enabled) summary.disabled += 1;
      if (outbound.maintenanceMode) summary.maintenance += 1;
      const status = this.normalizeStatus(outbound.healthStatus);
      if (status === 'healthy') summary.healthy += 1;
      else if (status === 'critical') summary.critical += 1;
      else if (status === 'degraded') summary.degraded += 1;

      return summary;
    }, { critical: 0, degraded: 0, disabled: 0, healthy: 0, maintenance: 0, total: 0 });
  }

  private summarizeAlerts(alerts: AdminAlertSummary[]): AdminReportAlertSummary {
    return alerts.reduce<AdminReportAlertSummary>((summary, alert) => {
      summary.open += 1;
      if (alert.severity === 'critical') summary.critical += 1;
      if (alert.severity === 'warning') summary.warning += 1;

      return summary;
    }, { critical: 0, open: 0, warning: 0 });
  }

  private summarizeBackups(backups: AdminBackupStatusSummary): AdminReportBackupSummary {
    return {
      status: backups.status,
      issueCount: backups.issues.length,
      criticalIssueCount: backups.issues.filter((issue) => issue.severity === 'critical').length,
      warningIssueCount: backups.issues.filter((issue) => issue.severity === 'warning').length,
      latestSuccessfulBackupAt: backups.latestSuccessfulBackupAt ?? null,
      restoreTestedAt: backups.restoreTestedAt ?? null,
    };
  }

  private summarizeRouteQuality(routeQuality: AdminRouteQualityAnalyticsResponse): AdminReportsSummaryResponse['routeQuality'] {
    const actionableRecommendations = routeQuality.recommendations.filter((item) => item.kind !== 'insufficientData');

    return {
      routeGroup: routeQuality.routeGroup,
      rangeHours: routeQuality.rangeHours,
      windowCount: routeQuality.windows.length,
      recommendationCount: actionableRecommendations.length,
      bestWindowCount: actionableRecommendations.filter((item) => item.kind === 'bestWindow').length,
      degradedWindowCount: actionableRecommendations.filter((item) => item.kind === 'degradedWindow').length,
      upcomingDegradedWindowCount: actionableRecommendations.filter((item) => item.kind === 'upcomingDegradedWindow').length,
      insufficientData: actionableRecommendations.length === 0,
      topRecommendations: actionableRecommendations.slice(0, 5),
    };
  }

  private scoreRisk(input: {
    alerts: AdminReportAlertSummary;
    backups: AdminReportBackupSummary;
    outbounds: AdminReportOutboundSummary;
    routeQuality: AdminReportsSummaryResponse['routeQuality'];
    servers: AdminReportServerSummary;
  }): Pick<AdminReportsSummaryResponse, 'reasonCodes' | 'riskLevel' | 'riskScore'> {
    const reasonCodes = new Set<string>();
    let riskScore = 0;

    riskScore += Math.min(input.alerts.critical * 12, 36);
    riskScore += Math.min(input.alerts.warning * 4, 16);
    riskScore += Math.min(input.servers.critical * 12, 36);
    riskScore += Math.min(input.servers.degraded * 5, 20);
    riskScore += Math.min(input.outbounds.critical * 8, 24);
    riskScore += Math.min(input.outbounds.degraded * 4, 16);
    riskScore += input.backups.status === 'critical' ? 20 : input.backups.status === 'warning' || input.backups.status === 'not_configured' ? 8 : 0;
    riskScore += Math.min(input.routeQuality.upcomingDegradedWindowCount * 3, 12);
    riskScore += Math.min(input.routeQuality.degradedWindowCount * 2, 10);

    if (input.alerts.critical > 0) reasonCodes.add('critical_alerts_open');
    if (input.alerts.warning > 0) reasonCodes.add('warning_alerts_open');
    if (input.servers.critical > 0) reasonCodes.add('servers_critical');
    if (input.servers.degraded > 0) reasonCodes.add('servers_degraded');
    if (input.outbounds.critical > 0) reasonCodes.add('outbounds_critical');
    if (input.outbounds.degraded > 0) reasonCodes.add('outbounds_degraded');
    if (input.outbounds.maintenance > 0) reasonCodes.add('outbounds_in_maintenance');
    if (input.backups.status === 'critical') reasonCodes.add('backup_critical');
    if (input.backups.status === 'warning' || input.backups.status === 'not_configured') reasonCodes.add('backup_warning');
    if (input.routeQuality.upcomingDegradedWindowCount > 0) reasonCodes.add('upcoming_degraded_route_windows');
    if (input.routeQuality.degradedWindowCount > 0) reasonCodes.add('degraded_route_windows');
    if (input.routeQuality.insufficientData) reasonCodes.add('route_quality_insufficient_data');
    if (reasonCodes.size === 0) reasonCodes.add('operations_healthy');

    riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

    return {
      riskScore,
      riskLevel: riskScore >= 70 ? 'critical' : riskScore >= 40 ? 'risk' : riskScore > 0 ? 'watch' : 'good',
      reasonCodes: Array.from(reasonCodes),
    };
  }

  private normalizeStatus(status: string): 'critical' | 'degraded' | 'healthy' | 'unknown' {
    if (status === 'healthy' || status === 'active' || status === 'up') return 'healthy';
    if (status === 'critical' || status === 'down' || status === 'failed' || status === 'offline') return 'critical';
    if (status === 'degraded' || status === 'warning' || status === 'limited' || status === 'stale') return 'degraded';

    return 'unknown';
  }
}
