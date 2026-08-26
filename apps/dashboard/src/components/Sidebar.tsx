import { ChevronDown, ChevronUp, Languages, LogOut, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ShieldCheck, X } from 'lucide-react';
import type { AdminSessionResponse } from '@afrows/shared';
import { appVersion } from '../app-config';
import type { ActiveView, SidebarAlertState } from '../dashboard-types';
import { dashboardLanguageLabel } from '../formatters';
import { LANGUAGE_TOGGLE_ENABLED } from '../i18n';
import type { DashboardLanguage, DashboardStrings } from '../i18n';
import { visibleNavGroups, type SidebarNavGroup, type SidebarNavItem } from '../nav-config';
import { activeNavEntryId, NAV_GROUPS, RESELLER_NAV_GROUPS, type NavGroupId } from '../nav-views';

export function Sidebar({
  activeTab,
  activeView,
  collapsedGroups,
  isCollapsed,
  isRtl,
  nextLanguage,
  onCloseMobile,
  onLanguageChange,
  onNavigate,
  onSignOut,
  onToggleCollapse,
  onToggleGroup,
  resellerTopupPendingState = null,
  sidebarAlertState,
  session,
  t,
  topupPendingState = null,
}: {
  /** Canonical `?tab=` value of the current URL (null when absent). */
  activeTab: string | null;
  activeView: ActiveView;
  /** Persisted collapsed sidebar groups (localStorage-backed in DashboardApp). */
  collapsedGroups: NavGroupId[];
  isCollapsed: boolean;
  isRtl: boolean;
  nextLanguage: DashboardLanguage;
  /** Mobile drawer close ("X") button; omitted on desktop where no drawer exists. */
  onCloseMobile?: () => void;
  onLanguageChange: (language: DashboardLanguage) => void;
  onNavigate: (item: SidebarNavItem) => void;
  onSignOut: () => void;
  onToggleCollapse: () => void;
  onToggleGroup: (groupId: NavGroupId) => void;
  /** Pending seller wallet top-up count badge on the Seller top-ups nav item (null hides it). */
  resellerTopupPendingState?: SidebarAlertState | null;
  sidebarAlertState: SidebarAlertState | null;
  session: AdminSessionResponse;
  t: DashboardStrings;
  /** Pending Telegram top-up count badge on the Top-ups nav item (null hides it). */
  topupPendingState?: SidebarAlertState | null;
}) {
  const groups = visibleNavGroups(session);
  const navModel = session.actor.role === 'reseller' ? RESELLER_NAV_GROUPS : NAV_GROUPS;
  const activeEntryId = activeNavEntryId(navModel, activeView, activeTab);
  const badgeStateFor = (item: SidebarNavItem): SidebarAlertState | null => {
    if (item.id === 'alerts') return sidebarAlertState;
    if (item.id === 'topups') return topupPendingState;
    if (item.id === 'reseller-topups') return resellerTopupPendingState;
    return null;
  };
  // Worst badge among a group's items, surfaced on the header while collapsed
  // so pending alerts/receipts stay visible even with the group folded away.
  const groupBadgeFor = (group: SidebarNavGroup): SidebarAlertState | null => {
    const states = group.items.map(badgeStateFor).filter((state): state is SidebarAlertState => state !== null);
    return states.find((state) => state.tone === 'critical') ?? states[0] ?? null;
  };

  return (
    <aside
      className={`relative flex h-full flex-col bg-afro-sidebar px-4 py-4 text-[#eef6f4] md:px-[18px] lg:py-6 ${isCollapsed ? 'lg:px-3' : ''}`}
      data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
    >
      <div className={`flex items-center justify-between gap-3 ${isCollapsed ? 'lg:justify-center' : ''}`}>
        <div className={`flex h-10 items-center gap-2.5 text-xl font-bold ${isCollapsed ? 'lg:justify-center' : ''}`}>
          <ShieldCheck size={22} />
          <span className={isCollapsed ? 'lg:sr-only' : ''}>Afrows</span>
        </div>
        {onCloseMobile ? (
          <button
            aria-label={t.closeNavMenu}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[#334852] text-[#c8d7d5] hover:border-[#5c7782] hover:text-white lg:hidden"
            onClick={onCloseMobile}
            title={t.closeNavMenu}
            type="button"
          >
            <X className="shrink-0" size={18} />
          </button>
        ) : null}
      </div>
      <SidebarToggle isCollapsed={isCollapsed} isRtl={isRtl} onToggle={onToggleCollapse} t={t} />
      <nav className="afro-scroll mt-5 min-h-0 flex-1 overflow-y-auto pe-1 lg:mt-7">
        {groups.map((group) => {
          const isGroupCollapsed = collapsedGroups.includes(group.id);
          const groupBadge = isGroupCollapsed ? groupBadgeFor(group) : null;
          const listId = `afro-nav-group-${group.id}`;

          if (isCollapsed) {
            // Icon rail: flat entries, no group headers (labels via title/aria).
            return (
              <div className="mb-1.5 grid gap-1.5 border-b border-[#25383f] pb-1.5 last:border-b-0" key={group.id} role="group" aria-label={t.navGroups[group.id]}>
                {group.items.map((item) => (
                  <NavItem
                    alertState={badgeStateFor(item)}
                    isActive={item.id === activeEntryId}
                    isSidebarCollapsed
                    item={item}
                    key={item.id}
                    onClick={() => onNavigate(item)}
                    t={t}
                  />
                ))}
              </div>
            );
          }

          return (
            <section className="mb-1" key={group.id}>
              <button
                aria-controls={listId}
                aria-expanded={!isGroupCollapsed}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-3 text-start text-[11px] font-bold uppercase tracking-wide text-[#7c9490] hover:bg-[#1f3138] hover:text-[#c8d7d5]"
                onClick={() => onToggleGroup(group.id)}
                type="button"
              >
                <span className="min-w-0 truncate">{t.navGroups[group.id]}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {groupBadge ? (
                    <span className={`inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[11px] leading-none normal-case ${groupBadge.tone === 'critical' ? 'border-[#ef4444] bg-[#dc2626] text-white' : 'border-[#d9972b] bg-[#f5b84b] text-[#20160a]'}`}>
                      {groupBadge.countLabel}
                    </span>
                  ) : null}
                  {isGroupCollapsed ? <ChevronDown className="shrink-0" size={14} /> : <ChevronUp className="shrink-0" size={14} />}
                </span>
              </button>
              <div className={`grid gap-1 pt-0.5 ${isGroupCollapsed ? 'hidden' : ''}`} id={listId}>
                {group.items.map((item) => (
                  <NavItem
                    alertState={badgeStateFor(item)}
                    isActive={item.id === activeEntryId}
                    isSidebarCollapsed={false}
                    item={item}
                    key={item.id}
                    onClick={() => onNavigate(item)}
                    t={t}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-[#334852] pt-3 text-xs text-[#91a5a2] lg:mt-6">
        {isCollapsed ? (
          <div className="hidden flex-col items-center gap-2 lg:flex">
            <LanguageButton nextLanguage={nextLanguage} onLanguageChange={onLanguageChange} t={t} />
            <SignOutButton onSignOut={onSignOut} t={t} />
            <div className="text-[11px] font-bold text-[#c8d7d5]">v{appVersion}</div>
          </div>
        ) : null}
        <div className={isCollapsed ? 'lg:hidden' : ''}>
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
        </div>
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
  item: SidebarNavItem;
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
    ? `${t.nav[item.id]} ${alertState.countLabel} ${t.status[alertState.tone]}`
    : t.nav[item.id];

  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      aria-label={ariaLabel}
      className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md px-3 text-start text-sm font-bold lg:min-h-10 ${activeClass} ${isSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
      data-view={item.id}
      onClick={onClick}
      title={ariaLabel}
      type="button"
    >
      <span className={`flex min-w-0 items-center gap-2 ${isSidebarCollapsed ? 'lg:justify-center' : ''}`}>
        <Icon className="shrink-0" size={18} />
        <span className={`min-w-0 truncate ${isSidebarCollapsed ? 'lg:sr-only' : ''}`}>{t.nav[item.id]}</span>
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
  if (!LANGUAGE_TOGGLE_ENABLED) return null; // Persian temporarily disabled
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
