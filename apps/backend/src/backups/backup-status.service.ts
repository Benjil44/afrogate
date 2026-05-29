import { Injectable } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AdminBackupIssueSummary,
  AdminBackupRetentionSummary,
  AdminBackupStatusSummary,
  BackupJobStatus,
} from '@afrogate/shared';

type BackupStatusPayload = Record<string, unknown>;

const BACKUP_STATUS_FILE_MAX_BYTES = 64 * 1024;
const DEFAULT_MAX_BACKUP_AGE_HOURS = 30;
const DEFAULT_RESTORE_TEST_MAX_AGE_DAYS = 30;
const DEFAULT_BACKUP_RETENTION: AdminBackupRetentionSummary = {
  dailyDays: 7,
  weeklyWeeks: 4,
  monthlyMonths: 3,
};
const backupArtifactKeys = ['postgres', 'config', 'secrets'];

@Injectable()
export class BackupStatusService {
  async getStatus(): Promise<AdminBackupStatusSummary> {
    const now = new Date();
    const statusFilePath = this.normalizeEnvString(process.env.AFROGATE_BACKUP_STATUS_FILE);
    const monitoringEnabled = this.readBoolean(
      process.env.AFROGATE_BACKUP_MONITORING_ENABLED,
      Boolean(statusFilePath),
    );
    const encryptionRequired = this.readBoolean(process.env.AFROGATE_BACKUP_ENCRYPTION_REQUIRED, true);
    const maxBackupAgeHours = this.readPositiveNumber(
      process.env.AFROGATE_BACKUP_MAX_AGE_HOURS,
      DEFAULT_MAX_BACKUP_AGE_HOURS,
    );
    const restoreTestMaxAgeDays = this.readPositiveNumber(
      process.env.AFROGATE_BACKUP_RESTORE_TEST_MAX_AGE_DAYS,
      DEFAULT_RESTORE_TEST_MAX_AGE_DAYS,
    );
    const retention = this.readRetention();
    const issues: AdminBackupIssueSummary[] = [];
    const statusFile = await this.readStatusFile(statusFilePath, monitoringEnabled, issues);
    const latestJobStatus = this.normalizeJobStatus(statusFile.payload?.latestJobStatus ?? statusFile.payload?.status);
    const latestBackupAt = this.parseTimestamp(
      statusFile.payload?.latestBackupAt ??
      statusFile.payload?.lastBackupAt ??
      statusFile.payload?.completedAt,
    );
    const latestSuccessfulBackupAt = this.parseTimestamp(
      statusFile.payload?.latestSuccessfulBackupAt ??
      statusFile.payload?.lastSuccessfulBackupAt ??
      (latestJobStatus === 'succeeded' ? latestBackupAt : null),
    );
    const latestFailedBackupAt = this.parseTimestamp(
      statusFile.payload?.latestFailedBackupAt ??
      statusFile.payload?.lastFailedBackupAt ??
      (latestJobStatus === 'failed' ? latestBackupAt : null),
    );
    const restoreTestedAt = this.parseTimestamp(
      statusFile.payload?.restoreTestedAt ??
      statusFile.payload?.lastRestoreTestedAt,
    );
    const encrypted = this.readOptionalBoolean(statusFile.payload?.encrypted);
    const latestBackupAgeHours = this.calculateAgeHours(latestSuccessfulBackupAt, now);
    const restoreTestAgeDays = this.calculateAgeDays(restoreTestedAt, now);
    const artifacts = this.readArtifacts(statusFile.payload?.artifacts);

    if (!monitoringEnabled) {
      issues.push({ code: 'backup_monitoring_not_configured', severity: 'warning' });
    } else {
      this.evaluateBackupIssues({
        artifacts,
        encrypted,
        encryptionRequired,
        issues,
        latestBackupAgeHours,
        latestJobStatus,
        latestSuccessfulBackupAt,
        maxBackupAgeHours,
        restoreTestAgeDays,
        restoreTestedAt,
        restoreTestMaxAgeDays,
      });
    }

    return {
      status: monitoringEnabled ? this.statusFromIssues(issues) : 'not_configured',
      latestJobStatus,
      monitoringEnabled,
      statusFileConfigured: Boolean(statusFilePath),
      statusFileReadable: statusFile.readable,
      statusFileUpdatedAt: statusFile.updatedAt,
      latestBackupAt,
      latestSuccessfulBackupAt,
      latestFailedBackupAt,
      latestBackupAgeHours,
      maxBackupAgeHours,
      encrypted,
      encryptionRequired,
      restoreTestedAt,
      restoreTestAgeDays,
      restoreTestMaxAgeDays,
      sizeBytes: this.readOptionalNumber(statusFile.payload?.sizeBytes),
      durationSeconds: this.readOptionalNumber(statusFile.payload?.durationSeconds),
      destinationType: this.sanitizeDisplayValue(statusFile.payload?.destinationType ?? process.env.AFROGATE_BACKUP_DESTINATION_TYPE),
      destinationLabel: this.sanitizeDisplayValue(statusFile.payload?.destinationLabel ?? process.env.AFROGATE_BACKUP_DESTINATION_LABEL),
      retention,
      artifacts,
      issues,
      updatedAt: now.toISOString(),
    };
  }

  private async readStatusFile(
    pathValue: string | null,
    monitoringEnabled: boolean,
    issues: AdminBackupIssueSummary[],
  ): Promise<{ payload: BackupStatusPayload | null; readable: boolean; updatedAt: string | null }> {
    if (!pathValue) {
      if (monitoringEnabled) issues.push({ code: 'backup_status_file_missing', severity: 'critical' });
      return { payload: null, readable: false, updatedAt: null };
    }

    try {
      const absolutePath = resolve(pathValue);
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        issues.push({ code: 'backup_status_file_unreadable', severity: 'critical' });
        return { payload: null, readable: false, updatedAt: null };
      }
      if (fileStat.size > BACKUP_STATUS_FILE_MAX_BYTES) {
        issues.push({ code: 'backup_status_file_too_large', severity: 'critical' });
        return { payload: null, readable: false, updatedAt: fileStat.mtime.toISOString() };
      }

      const fileContent = await readFile(absolutePath, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(fileContent) as unknown;
      } catch {
        issues.push({ code: 'backup_status_file_invalid', severity: 'critical' });
        return { payload: null, readable: false, updatedAt: fileStat.mtime.toISOString() };
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        issues.push({ code: 'backup_status_file_invalid', severity: 'critical' });
        return { payload: null, readable: false, updatedAt: fileStat.mtime.toISOString() };
      }

      return {
        payload: parsed as BackupStatusPayload,
        readable: true,
        updatedAt: fileStat.mtime.toISOString(),
      };
    } catch {
      issues.push({ code: 'backup_status_file_unreadable', severity: 'critical' });
      return { payload: null, readable: false, updatedAt: null };
    }
  }

  private evaluateBackupIssues({
    artifacts,
    encrypted,
    encryptionRequired,
    issues,
    latestBackupAgeHours,
    latestJobStatus,
    latestSuccessfulBackupAt,
    maxBackupAgeHours,
    restoreTestAgeDays,
    restoreTestedAt,
    restoreTestMaxAgeDays,
  }: {
    artifacts: string[];
    encrypted: boolean | null;
    encryptionRequired: boolean;
    issues: AdminBackupIssueSummary[];
    latestBackupAgeHours: number | null;
    latestJobStatus: BackupJobStatus;
    latestSuccessfulBackupAt: string | null;
    maxBackupAgeHours: number;
    restoreTestAgeDays: number | null;
    restoreTestedAt: string | null;
    restoreTestMaxAgeDays: number;
  }) {
    if (latestJobStatus === 'failed') issues.push({ code: 'latest_backup_failed', severity: 'critical' });
    if (latestJobStatus === 'running') issues.push({ code: 'backup_job_running', severity: 'warning' });
    if (!latestSuccessfulBackupAt) {
      issues.push({ code: 'no_successful_backup', severity: 'critical' });
    } else if (latestBackupAgeHours !== null && latestBackupAgeHours > maxBackupAgeHours) {
      issues.push({ code: 'backup_stale', severity: 'critical' });
    }
    if (encryptionRequired && encrypted !== true) {
      issues.push({ code: 'backup_not_encrypted', severity: 'critical' });
    }
    if (!restoreTestedAt) {
      issues.push({ code: 'restore_test_missing', severity: 'warning' });
    } else if (restoreTestAgeDays !== null && restoreTestAgeDays > restoreTestMaxAgeDays) {
      issues.push({ code: 'restore_test_stale', severity: 'warning' });
    }
    if (artifacts.length === 0) {
      issues.push({ code: 'backup_artifacts_missing', severity: 'warning' });
      return;
    }

    for (const artifactKey of backupArtifactKeys) {
      if (!artifacts.includes(artifactKey)) {
        issues.push({ code: `${artifactKey}_backup_not_confirmed`, severity: 'warning' });
      }
    }
  }

  private statusFromIssues(issues: AdminBackupIssueSummary[]): AdminBackupStatusSummary['status'] {
    if (issues.some((issue) => issue.severity === 'critical')) return 'critical';
    if (issues.some((issue) => issue.severity === 'warning')) return 'warning';

    return 'healthy';
  }

  private normalizeJobStatus(value: unknown): BackupJobStatus {
    if (value === 'succeeded' || value === 'success' || value === 'completed') return 'succeeded';
    if (value === 'failed' || value === 'failure' || value === 'error') return 'failed';
    if (value === 'running' || value === 'in_progress') return 'running';

    return 'unknown';
  }

  private readRetention(): AdminBackupRetentionSummary {
    return {
      dailyDays: this.readPositiveNumber(process.env.AFROGATE_BACKUP_RETENTION_DAILY_DAYS, DEFAULT_BACKUP_RETENTION.dailyDays),
      weeklyWeeks: this.readPositiveNumber(process.env.AFROGATE_BACKUP_RETENTION_WEEKLY_WEEKS, DEFAULT_BACKUP_RETENTION.weeklyWeeks),
      monthlyMonths: this.readPositiveNumber(process.env.AFROGATE_BACKUP_RETENTION_MONTHLY_MONTHS, DEFAULT_BACKUP_RETENTION.monthlyMonths),
    };
  }

  private readArtifacts(value: unknown): string[] {
    const rawItems = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',')
        : (process.env.AFROGATE_BACKUP_ARTIFACTS ?? '').split(',');

    return rawItems
      .map((item) => this.sanitizeDisplayValue(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 12);
  }

  private parseTimestamp(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString();
  }

  private calculateAgeHours(value: string | null, now: Date): number | null {
    if (!value) return null;

    return Math.max(0, (now.getTime() - Date.parse(value)) / (60 * 60 * 1000));
  }

  private calculateAgeDays(value: string | null, now: Date): number | null {
    if (!value) return null;

    return Math.max(0, (now.getTime() - Date.parse(value)) / (24 * 60 * 60 * 1000));
  }

  private readBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value.trim() === '') return fallback;

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  private readOptionalBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return null;

    return this.readBoolean(value, false);
  }

  private readPositiveNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

    return Math.trunc(parsed);
  }

  private readOptionalNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;

    return parsed;
  }

  private sanitizeDisplayValue(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;

    const normalized = String(value)
      .trim()
      .replace(/\/\/[^/@\s]+@/g, '//[redacted]@');
    if (!normalized) return null;

    return normalized.slice(0, 120);
  }

  private normalizeEnvString(value: string | undefined): string | null {
    if (!value) return null;

    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}
