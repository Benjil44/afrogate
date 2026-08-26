import { Fragment, useId, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DataTableColumn, TableCellAlign } from '../dashboard-types';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

/**
 * Typed column definition for the shared DataTable. Superset of the legacy
 * `DataTableColumn` shape from `dashboard-types` (which stays assignable), so
 * existing call sites keep working while new ones can pass rich headers
 * (e.g. sort buttons) and fixed widths.
 */
export interface DataTableColumnDef<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  align?: TableCellAlign;
  /** Legacy alias for `align: 'right'`. */
  alignRight?: boolean;
  /** Extra classes on the header cell. */
  className?: string;
  /** Optional fixed/preferred column width (any CSS width value). */
  width?: string;
}

/**
 * Optional row grouping: a section renders an optional full-width header row
 * (page supplies the content, incl. any expand/collapse control), then its
 * rows, then `emptyContent` as a full-width row when it has no rows.
 */
export interface DataTableSection<Row> {
  key: string;
  /** Full-width section header content (spans every column except the actions cell). */
  header?: ReactNode;
  /** Optional trailing cell on the section header row (e.g. group actions). */
  headerActions?: ReactNode;
  headerClassName?: string;
  rows: Row[];
  /** Rendered as a full-width row when the section has a header but no rows. */
  emptyContent?: ReactNode;
}

/** Localized empty-state config; DataTable delegates rendering to EmptyState. */
export interface DataTableEmptyConfig {
  detail?: string;
  message: string;
}

/** Localized error-state config; DataTable delegates rendering to ErrorState. */
export interface DataTableErrorConfig {
  detail?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Sticky trailing column: pinned to the inline-end edge of the horizontal scroller
 * (logical `end-0`, so it is RTL-correct) with an opaque background and a 1px
 * inline-start separator painted via inset shadow — collapsed table borders do not
 * travel with sticky cells, so the shadow keeps the row/column lines visible. */
const stickyCellShadow =
  'shadow-[inset_1px_0_0_var(--color-afro-line),inset_0_-1px_0_var(--color-afro-line)] rtl:shadow-[inset_-1px_0_0_var(--color-afro-line),inset_0_-1px_0_var(--color-afro-line)]';
const stickyCellClass = `sticky end-0 z-[1] bg-afro-panel ${stickyCellShadow}`;

/**
 * Shared page-level table primitive. Presentational only — data fetching and
 * state machines stay in the pages. Always horizontally scrollable inside its
 * own container so the page body never scrolls horizontally; supports loading
 * skeleton rows, localized empty/error states (delegated to EmptyState /
 * ErrorState), optional row click, expandable detail rows, row sections, and
 * an RTL-correct sticky action column.
 */
export function DataTable<Row>({
  columns,
  detailCollapseLabel,
  detailExpandLabel,
  empty,
  error,
  loading = false,
  loadingLabel,
  minWidth = '760px',
  onRowClick,
  renderDetail,
  rowClassName,
  rowKey,
  rows,
  sections,
  skeletonRows = 3,
  stickyLastColumn = false,
}: {
  columns: Array<DataTableColumnDef<Row>> | Array<DataTableColumn<Row>>;
  /** Accessible label for collapsing an open detail row. Provide it together with renderDetail. */
  detailCollapseLabel?: string;
  /** Accessible label for expanding a row's detail panel. Provide it together with renderDetail. */
  detailExpandLabel?: string;
  /** Localized empty state, shown when there are no rows (and no error/loading). */
  empty?: DataTableEmptyConfig | null;
  /** Localized error state, shown instead of rows when there is no data to keep on screen. */
  error?: DataTableErrorConfig | null;
  /** While true and no rows exist yet, renders animated skeleton rows. */
  loading?: boolean;
  /** Accessible label announced while the skeleton is shown (e.g. `t.panelStates.loadingTitle`). */
  loadingLabel?: string;
  minWidth?: string;
  /** Optional whole-row click. Ignored for taps on interactive cells; when renderDetail is set the row tap toggles the detail panel instead. */
  onRowClick?: (row: Row) => void;
  /**
   * Optional inline detail panel rendered full-width directly under a row.
   * When set, each row gains a leading chevron toggle (and the row itself becomes
   * tappable) so actions stay reachable on narrow screens where trailing columns
   * would sit beyond the horizontal scroll.
   */
  renderDetail?: (row: Row) => ReactNode;
  rowClassName?: (row: Row) => string | undefined;
  rowKey: (row: Row) => string;
  /** Flat rows. Ignored when `sections` is provided. */
  rows?: Row[];
  /** Grouped rows with optional full-width section header rows. */
  sections?: Array<DataTableSection<Row>>;
  skeletonRows?: number;
  /**
   * Pin the last column (usually row actions) to the inline-end edge of the
   * horizontal scroller so actions stay reachable at any viewport width.
   * RTL-correct (uses logical inset-inline-end).
   */
  stickyLastColumn?: boolean;
}) {
  const detailIdPrefix = useId();
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const columnDefs = columns as Array<DataTableColumnDef<Row>>;
  const hasDetail = Boolean(renderDetail);
  const colCount = columnDefs.length + (hasDetail ? 1 : 0);
  const sectionList: Array<DataTableSection<Row>> = sections ?? [{ key: 'rows', rows: rows ?? [] }];
  const hasContent = sectionList.some((section) => section.header != null || section.rows.length > 0);
  const showError = !hasContent && Boolean(error);
  const showLoading = !hasContent && !showError && loading;
  const showEmpty = !hasContent && !showError && !showLoading && Boolean(empty);
  const toggleRow = (key: string) => setExpandedRows((current) => ({ ...current, [key]: !current[key] }));
  const onRowTap = (event: MouseEvent<HTMLTableRowElement>, row: Row, key: string) => {
    // Row tap toggles the detail panel / fires onRowClick, but never steals taps
    // from interactive cells.
    if ((event.target as HTMLElement).closest('a,button,input,label,select,textarea')) return;
    if (hasDetail) toggleRow(key);
    else onRowClick?.(row);
  };
  const stateCellClass = 'border-b border-afro-line px-2 py-3 first:ps-0 last:pe-0';

  return (
    // overflow-y-clip: with overflow-x auto alone, overflow-y computes to auto and can
    // spawn a nested vertical scrollbar; clip (used value: hidden) guarantees this
    // wrapper only ever scrolls horizontally — the page keeps a single vertical scroll.
    <div aria-busy={showLoading} className={`overflow-x-auto overflow-y-clip ${hasDetail ? '[container-type:inline-size]' : ''}`}>
      {showLoading && loadingLabel ? (
        <span className="sr-only" role="status">
          {loadingLabel}
        </span>
      ) : null}
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr>
            {hasDetail ? (
              <th className="w-9 border-b border-afro-line py-1.5 ps-0 pe-1" scope="col">
                <span className="sr-only">{detailExpandLabel}</span>
              </th>
            ) : null}
            {columnDefs.map((column, columnIndex) => (
              <th
                className={`border-b border-afro-line px-2 py-1.5 text-[13px] font-bold text-afro-muted first:ps-0 last:pe-0 ${tableAlignmentClass(column.align, column.alignRight)} ${stickyLastColumn && columnIndex === columnDefs.length - 1 ? stickyCellClass : ''} ${column.className ?? ''}`}
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showError && error ? (
            <tr>
              <td className={stateCellClass} colSpan={colCount}>
                <ErrorState detail={error.detail} message={error.message} onRetry={error.onRetry} retryLabel={error.retryLabel} />
              </td>
            </tr>
          ) : null}
          {showLoading
            ? Array.from({ length: Math.max(1, skeletonRows) }, (_, index) => (
                <tr aria-hidden="true" key={`skeleton-${index}`}>
                  {hasDetail ? <td className="border-b border-afro-line py-2.5 ps-0 pe-1" /> : null}
                  {columnDefs.map((column) => (
                    <td className="border-b border-afro-line px-2 py-2.5 first:ps-0 last:pe-0" key={column.key}>
                      <span
                        className={`block h-4 w-full max-w-[9rem] animate-pulse rounded bg-afro-line/70 ${
                          column.align === 'right' || column.alignRight ? 'ms-auto' : column.align === 'center' ? 'mx-auto' : ''
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {showEmpty && empty ? (
            <tr>
              <td className={stateCellClass} colSpan={colCount}>
                <EmptyState detail={empty.detail} message={empty.message} />
              </td>
            </tr>
          ) : null}
          {sectionList.map((section) => (
            <Fragment key={section.key}>
              {section.header != null ? (
                <tr className={section.headerClassName}>
                  <td
                    className="border-b border-afro-line px-2 py-2 first:ps-0 last:pe-0 align-middle"
                    colSpan={section.headerActions != null ? colCount - 1 : colCount}
                  >
                    {section.header}
                  </td>
                  {section.headerActions != null ? (
                    <td
                      className={`border-b border-afro-line px-2 py-2 last:pe-0 align-middle ${stickyLastColumn ? stickyCellClass : ''}`}
                    >
                      {section.headerActions}
                    </td>
                  ) : null}
                </tr>
              ) : null}
              {section.rows.map((row) => {
                const key = rowKey(row);
                const isOpen = hasDetail && Boolean(expandedRows[key]);
                const detailId = `${detailIdPrefix}-${key}`;
                const toggleLabel = isOpen ? detailCollapseLabel : detailExpandLabel;
                const clickable = hasDetail || Boolean(onRowClick);

                return (
                  <Fragment key={key}>
                    <tr
                      className={`group ${rowClassName?.(row) ?? ''} ${clickable ? 'cursor-pointer hover:bg-[#f8fafb]' : ''}`}
                      onClick={clickable ? (event) => onRowTap(event, row, key) : undefined}
                    >
                      {hasDetail ? (
                        <td className="border-b border-afro-line py-1.5 ps-0 pe-1 align-middle">
                          <button
                            aria-controls={detailId}
                            aria-expanded={isOpen}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-afro-line text-afro-muted transition hover:border-afro-teal hover:text-afro-teal md:h-8 md:w-8"
                            onClick={() => toggleRow(key)}
                            title={toggleLabel}
                            type="button"
                          >
                            <span className="sr-only">{toggleLabel}</span>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight className="rtl:-scale-x-100" size={15} />}
                          </button>
                        </td>
                      ) : null}
                      {columnDefs.map((column, columnIndex) => (
                        <TableCell
                          align={column.align}
                          alignRight={column.alignRight}
                          className={
                            stickyLastColumn && columnIndex === columnDefs.length - 1
                              ? // Background must track the row's hover state so the pinned cell
                                // never looks detached from its row.
                                `${stickyCellClass} ${clickable ? 'group-hover:bg-[#f8fafb]' : ''}`
                              : undefined
                          }
                          key={column.key}
                        >
                          {column.render(row)}
                        </TableCell>
                      ))}
                    </tr>
                    {isOpen && renderDetail ? (
                      <tr id={detailId}>
                        <td className="border-b border-afro-line bg-[#f8fafb] p-0" colSpan={colCount}>
                          {/* Sticky + container-width cap keeps the panel fully visible inside the
                              horizontal scroller, even when the table itself is wider than the screen. */}
                          <div className="sticky start-0 max-w-[100cqw] px-2 py-2.5">{renderDetail(row)}</div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {section.header != null && section.rows.length === 0 && section.emptyContent != null ? (
                <tr>
                  <td className="border-b border-afro-line px-2 py-3 first:ps-0 last:pe-0" colSpan={colCount}>
                    {section.emptyContent}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function tableAlignmentClass(align?: TableCellAlign, alignRight = false): string {
  // Logical alignment keeps every DataTable RTL-correct: identical in LTR,
  // properly mirrored in fa.
  if (align === 'center') return 'text-center';
  if (align === 'right' || alignRight) return 'text-end';

  return 'text-start';
}

function cellTooltip(value: ReactNode): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return undefined;
}

export function TableCell({
  align,
  alignRight = false,
  children,
  className,
}: {
  align?: TableCellAlign;
  alignRight?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const alignmentClass = tableAlignmentClass(align, alignRight);
  const tooltip = cellTooltip(children);

  return (
    <td
      className={`border-b border-afro-line px-2 py-1.5 align-middle text-[13px] text-afro-muted first:ps-0 last:pe-0 ${alignmentClass} ${className ?? ''}`}
      title={tooltip}
    >
      {children}
    </td>
  );
}
