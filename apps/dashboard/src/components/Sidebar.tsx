import { ChevronDown, ChevronUp, Languages, LogOut, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ShieldCheck } from 'lucide-react';
import type { AdminSessionResponse } from '@afrows/shared';
import { appVersion, resellerNavViews } from '../app-config';
import type { ActiveView, NavItemData, SidebarAlertState } from '../dashboard-types';
import { dashboardLanguageLabel } from '../formatters';
import type { DashboardLanguage, DashboardStrings } from '../i18n';
import { ADVANCED_NAV, MAIN_NAV } from '../nav-config';
import { canViewAdminUsers, canViewAuditLogs, canViewBackupStatus, canViewReports } from '../session-access';

function filterNavForSession(items: NavItemData[], session: AdminSessionResponse): NavItemData[] {
  return items.filter((item) => {
    if (session.actor.role === 'reseller') return resellerNavViews.has(item.id);
    if (item.id === 'users') return canViewAdminUsers(session);
    if (item.id === 'audit') return canViewAuditLogs(session);
    if (item.id === 'backups') return canViewBackupStatus(session);
    if (item.id === 'reports') return canViewReports(session);
    return true;
  });
}

export function Sidebar({
  activeView,
  advancedMode,
  isCollapsed,
  isRtl,
  nextLanguage,
  onLanguageChange,
  onSignOut,
  onToggleAdvancedMode,
  onToggleCollapse,
  onViewChange,
  sidebarAlertState,
  session,
  t,
}: {
  activeView: ActiveView;
  advancedMode: boolean;
  isCollapsed: boolean;
  isRtl: boolean;
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  onSignOut: () => void;
  onToggleAdvancedMode: () => void;
  onToggleCollapse: () => void;
  onViewChange: (view: ActiveView) => void;
  sidebarAlertState: SidebarAlertState | null;
  session: AdminSessionResponse;
  t: DashboardStrings;
}) {
  const mainItems = filterNavForSession(MAIN_NAV, session);
  const advancedItems = filterNavForSession(ADVANCED_NAV, session);
  const canUseAdvancedToggle = session.actor.role !== 'reseller';
  const showAdvanced = advancedMode && canUseAdvancedToggle && advancedItems.length > 0;

  return (
    <aside
      className={`relative bg-afro-sidebar px-4 py-4 text-[#eef6f4] md:px-[18px] lg:flex lg:h-screen lg:flex-col lg:overflow-visible lg:py-6 ${isCollapsed ? 'lg:px-3' : ''}`}
      data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
    >
      <div className={`flex items-center justify-between gap-3 ${isCollapsed ? 'lg:justify-center' : 'lg:block'}`}>
        <div className={`flex h-10 items-center gap-2.5 text-xl font-bold ${isCollapsed ? 'lg:justify-center' : ''}`}>
          <ShieldCheck size={22} />
          <span className={isCollapsed ? 'lg:sr-only' : ''}>Afrows</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#91a5a2] lg:hidden">
          <span>v{appVersion}</span>
          <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
          <SignOutButton onSignOut={onSignOut} t={t} />
        </div>
      </div>
      <SidebarToggle isCollapsed={isCollapsed} isRtl={isRtl} onToggle={onToggleCollapse} t={t} />
      <nav className={`afro-scroll mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-6 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:content-start lg:overflow-y-auto lg:pr-1 ${isCollapsed ? 'lg:mt-6' : 'lg:mt-8'}`}>
        {mainItems.map((item) => (
          <NavItem
            item={item}
            alertState={item.id === 'alerts' ? sidebarAlertState : null}
            isActive={activeView === item.id}
            isSidebarCollapsed={isCollapsed}
            key={item.id}
            onClick={() => onViewChange(item.id)}
            t={t}
          />
        ))}
        {canUseAdvancedToggle && advancedItems.length > 0 ? (
          <>
            <button
              type="button"
              onClick={onToggleAdvancedMode}
              aria-expanded={showAdvanced}
              title={showAdvanced ? t.hideAdvancedNav : t.showAdvancedNav}
              className={`col-span-2 mt-2 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-wide text-[#7c9490] hover:text-[#c8d7d5] sm:col-span-6 lg:col-span-1 ${isCollapsed ? 'lg:justify-center' : 'justify-between'}`}
            >
              <span className={isCollapsed ? 'lg:sr-only' : ''}>{t.advancedNavGroup}</span>
              {showAdvanced ? <ChevronUp className="shrink-0" size={14} /> : <ChevronDown className="shrink-0" size={14} />}
            </button>
            {showAdvanced
              ? advancedItems.map((item) => (
                  <NavItem
                    item={item}
                    alertState={item.id === 'alerts' ? sidebarAlertState : null}
                    isActive={activeView === item.id}
                    isSidebarCollapsed={isCollapsed}
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    t={t}
                  />
                ))
              : null}
          </>
        ) : null}
      </nav>
      <div className="hidden text-xs text-[#91a5a2] lg:mt-6 lg:block lg:border-t lg:border-[#334852] lg:pt-3">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
            <SignOutButton onSignOut={onSignOut} t={t} />
            <div className="text-[11px] font-bold text-[#c8d7d5]">v{appVersion}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[#c8d7d5]">Afrows</div>
                <div>v{appVersion}</div>
              </div>
              <div className="flex items-center gap-2">
                <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
                <SignOutButton onSignOut={onSignOut} t={t} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span>{t.languageName}</span>
              <span className="truncate font-bold text-[#c8d7d5]">{t.auth.sessionRole(session.actor.role)}</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export function KioskToggleButton({ isActive, onToggle, t }: { isActive: boolean; onToggle: () => void; t: DashboardStrings }) {
  const Icon = isActive ? Minimize2 : Maximize2;
  const label = isActive ? t.exitKioskMode : t.enterKioskMode;

  return (
    <button
      aria-label={label}
      aria-pressed={isActive}
      className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border border-afro-line bg-white px-2 text-afro-ink shadow-sm hover:border-afro-blue hover:text-afro-blue"
      data-kiosk-toggle="true"
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Icon className="shrink-0" size={15} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function SignOutButton({ onSignOut, t }: { onSignOut: () => void; t: DashboardStrings }) {
  return (
    <button
      aria-label={t.auth.signOut}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[#334852] text-[#c8d7d5] hover:border-[#5c7782] hover:text-white"
      onClick={onSignOut}
      title={t.auth.signOut}
      type="button"
    >
      <LogOut className="shrink-0" size={16} />
    </button>
  );
}


function SidebarToggle({
  isCollapsed,
  isRtl,
  onToggle,
  t,
}: {
  isCollapsed: boolean;
  isRtl: boolean;
  onToggle: () => void;
  t: DashboardStrings;
}) {
  const Icon = isRtl
    ? isCollapsed ? PanelRightOpen : PanelRightClose
    : isCollapsed ? PanelLeftOpen : PanelLeftClose;
  const label = isCollapsed ? t.expandSidebar : t.collapseSidebar;
  const edgeClass = isRtl ? 'lg:-left-4' : 'lg:-right-4';

  return (
    <button
      aria-pressed={isCollapsed}
      aria-label={label}
      className={`absolute top-6 z-20 hidden size-8 items-center justify-center rounded-full border border-[#334852] bg-[#16262d] text-[#c8d7d5] shadow-lg hover:border-[#5c7782] hover:bg-[#1f3138] hover:text-white lg:inline-flex ${edgeClass}`}
      data-sidebar-toggle="true"
      onClick={onToggle}
      title={label}
      type="button"
    >
      <Icon className="shrink-0" size={16} />
    </button>
  );
}

function NavItem({
  alertState,
  item,
  isActive,
  isSidebarCollapsed,
  onClick,
  t,
}: {
  alertState: SidebarAlertState | null;
  item: NavItemData;
  isActive: boolean;
  isSidebarCollapsed: boolean;
  onClick: () => void;
  t: DashboardStrings;
}) {
  const Icon = item.icon;
  const alertClass = alertState
    ? {
        critical: isActive
          ? 'bg-[#4a1118] text-white ring-1 ring-[#ef4444]/50'
          : 'text-[#fecaca] hover:bg-[#3b1014] hover:text-white',
        warning: isActive
          ? 'bg-[#3c2a12] text-white ring-1 ring-[#d9972b]/50'
          : 'text-[#f4d7a1] hover:bg-[#3c2a12] hover:text-white',
      }[alertState.tone]
    : null;
  const defaultClass = isActive ? 'bg-[#1f3138] text-white' : 'text-[#c8d7d5] hover:bg-[#1f3138] hover:text-white';
  const activeClass = alertClass ?? defaultClass;
  const badgeClass = alertState
    ? {
        critical: 'border-[#ef4444] bg-[#dc2626] text-white',
        warning: 'border-[#d9972b] bg-[#f5b84b] text-[#20160a]',
      }[alertState.tone]
    : '';
  const ariaLabel = alertState
    ? `${t.nav[item.labelKey]} ${alertState.countLabel} ${t.status[alertState.tone]}`
    : t.nav[item.labelKey];

  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      aria-label={ariaLabel}
      className={`flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-md px-3 text-left text-sm font-bold ${activeClass} ${isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
      data-view={item.id}
      onClick={onClick}
      title={ariaLabel}
      type="button"
    >
      <span className={`flex min-w-0 items-center gap-2 ${isSidebarCollapsed ? 'lg:justify-center' : ''}`}>
        <Icon className="shrink-0" size={18} />
        <span className={`min-w-0 truncate ${isSidebarCollapsed ? 'lg:sr-only' : ''}`}>{t.nav[item.labelKey]}</span>
      </span>
      {alertState ? (
        <span className={`inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full border px-1 text-[11px] leading-none ${badgeClass}`}>
          {alertState.countLabel}
        </span>
      ) : null}
    </button>
  );
}

export function LanguageButton({
  nextLanguage,
  onLanguageChange,
  variant = 'dark',
  t,
}: {
  nextLanguage: DashboardLanguage;
  onLanguageChange: (language: DashboardLanguage) => void;
  variant?: 'dark' | 'light';
  t: DashboardStrings;
}) {
  const className = variant === 'light'
    ? 'inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-afro-line px-2 text-afro-ink hover:border-afro-teal hover:text-afro-teal'
    : 'inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-md border border-[#334852] px-2 text-[#c8d7d5] hover:border-[#5c7782] hover:text-white';

  return (
    <button
      aria-label={`${t.switchLanguage}: ${dashboardLanguageLabel(nextLanguage)}`}
      className={className}
      onClick={() => onLanguageChange(nextLanguage)}
      title={`${t.switchLanguage}: ${dashboardLanguageLabel(nextLanguage)}`}
      type="button"
    >
      <Languages className="shrink-0" size={16} />
      <span className="text-[11px] font-bold">{t.nextLanguageLabel}</span>
    </button>
  );
}
