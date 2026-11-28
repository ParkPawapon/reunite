'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { ShellIcon } from '@/components/shell/shell-icon';
import { useShellMotion } from '@/components/shell/shell-motion';
import { REPORT_TITLE_LIMIT } from '@/modules/item-reports/domain/report';
import {
  loadReportPage,
  REPORT_PAGE_SIZE,
  ReportRequestError,
  type ReportRow,
  type ReportStatus,
  type ReportType,
} from '@/modules/item-reports/presentation/reports-client';
import { ReportTable, reportStatusLabels } from './report-table';
import { ReportDetail } from './report-detail';
import styles from './report-board.module.css';

const SEARCH_DELAY_MS = 250;

type PageState = {
  key: string;
  kind: 'loading' | 'error' | 'ready';
  rows: ReportRow[];
  hasNext: boolean;
};
export function DashboardContent({
  name,
  owned = false,
}: {
  name?: string;
  owned?: boolean;
}) {
  const id = useId();
  const motion = useShellMotion();
  const [view, setView] = useState<{
    type: ReportType;
    page: number;
    revision: number;
    q: string;
    status: ReportStatus | '';
  }>({
    type: 'LOST',
    page: 0,
    revision: 0,
    q: '',
    status: owned ? '' : 'OPEN',
  });
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const query = search.trim();
  const searchField = useRef<HTMLInputElement>(null);
  const updated = useRef(false);
  const [state, setState] = useState<PageState>({
    key: '',
    kind: 'loading',
    rows: [],
    hasNext: false,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const key = `${view.type}:${view.status}:${view.page}:${view.revision}:${view.q}`;
  const current = state.key === key;
  const loading = !current || state.kind === 'loading';
  const failed = current && state.kind === 'error';
  const rows = current && state.kind === 'ready' ? state.rows : [];
  useEffect(() => {
    if (composing || query === view.q) return;
    const timer = window.setTimeout(
      () => setView((value) => ({ ...value, q: query, page: 0 })),
      query ? SEARCH_DELAY_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [composing, query, view.q]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadReportPage(
      view.type,
      view.page * REPORT_PAGE_SIZE,
      controller.signal,
      { q: view.q, owned, status: view.status || undefined },
    )
      .then((result) => {
        if (active) setState({ key, kind: 'ready', ...result });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ReportRequestError && error.status === 401) {
          window.location.replace('/login');
          return;
        }
        setState({ key, kind: 'error', rows: [], hasNext: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, owned, view.type, view.page, view.q, view.status]);
  const refresh = () =>
    setView((value) => ({ ...value, revision: value.revision + 1 }));
  const lost = view.type === 'LOST';
  const label = lost ? 'ของหาย' : 'ของที่พบ';
  return (
    <div
      className={styles.root}
      data-dashboard
      data-board-motion={motion ? 'running' : 'still'}
    >
      <header className={styles.pageHeader}>
        <div>
          {!owned && (
            <p className={styles.greeting}>
              สวัสดี, <span>{name}</span>
            </p>
          )}
          <h1>{owned ? 'รายการของฉัน' : 'ช่วยกันหา พากลับคืน'}</h1>
          <p className={styles.intro}>
            {owned
              ? 'ดูสถานะและจัดการประกาศที่คุณแจ้งไว้'
              : 'ของหายที่เจ้าของตามหา และของที่มีคนพบ'}
          </p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={refresh}
          disabled={loading}
          aria-label="รีเฟรชรายการ"
          title="รีเฟรชรายการ"
        >
          <ShellIcon name="refresh" width={17} height={17} />
        </button>
      </header>
      <section className={styles.board} aria-label="รายการสิ่งของ">
        <div className={styles.tabsBar}>
          <Tabs
            value={view.type}
            onChange={(_, type: ReportType) =>
              setView((value) => ({ ...value, type, page: 0 }))
            }
            aria-label="ประเภทรายการ"
            selectionFollowsFocus
            className={styles.tabs}
            slotProps={{
              indicator: {
                style: { transitionDuration: motion ? '180ms' : '0ms' },
              },
            }}
          >
            <Tab
              value="LOST"
              label="ของหาย"
              id={`${id}-tab-LOST`}
              aria-controls={`${id}-panel`}
            />
            <Tab
              value="FOUND"
              label="ของที่พบ"
              id={`${id}-tab-FOUND`}
              aria-controls={`${id}-panel`}
            />
          </Tabs>
          <span className={styles.order}>แจ้งล่าสุดก่อน</span>
        </div>
        <div className={styles.toolbar}>
          <div role="search" className={styles.search}>
            <label className={styles.srOnly} htmlFor={`${id}-search`}>
              ค้นหาชื่อสิ่งของ
            </label>
            <ShellIcon name="search" width={17} height={17} />
            <input
              id={`${id}-search`}
              ref={searchField}
              type="search"
              maxLength={REPORT_TITLE_LIMIT}
              placeholder="ค้นหาชื่อสิ่งของ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(event) => {
                setSearch(event.currentTarget.value);
                setComposing(false);
              }}
            />
            {(search || view.q) && (
              <button
                type="button"
                className={styles.clearSearch}
                aria-label="ล้างการค้นหา"
                title="ล้างการค้นหา"
                onClick={() => {
                  setSearch('');
                  searchField.current?.focus();
                }}
              >
                <ShellIcon name="close" width={16} height={16} />
              </button>
            )}
          </div>
          <div className={styles.statusFilter}>
            <label htmlFor={`${id}-status`}>สถานะประกาศ</label>
            <span className={styles.statusChoice} data-status={view.status}>
              <select
                id={`${id}-status`}
                value={view.status}
                onChange={(event) => {
                  const status = event.target.value as ReportStatus | '';
                  setView((value) => ({ ...value, status, page: 0 }));
                }}
              >
                {Object.entries(reportStatusLabels).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
                <option value="">ทั้งหมด</option>
              </select>
              <ShellIcon name="chevron" width={16} height={16} />
            </span>
          </div>
        </div>
        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${view.type}`}
          aria-busy={loading}
        >
          <div className={styles.context}>
            <p>
              {view.q
                ? `ผลการค้นหา “${view.q}”`
                : owned
                  ? `${label}ที่คุณแจ้ง`
                  : lost
                    ? 'เจ้าของแจ้งตามหา'
                    : 'มีคนพบและแจ้งไว้'}
            </p>
            <span>
              {loading
                ? 'กำลังโหลดรายการ…'
                : failed
                  ? 'โหลดไม่สำเร็จ'
                  : rows.length
                    ? `แสดง ${rows.length} รายการ`
                    : 'ยังไม่มีรายการ'}
            </span>
          </div>
          <p className={styles.srOnly} role="status">
            {loading
              ? `กำลังโหลดรายการ${label}`
              : failed
                ? ''
                : `${label} ${rows.length} รายการในหน้านี้`}
          </p>
          {failed ? (
            <div role="alert" className={styles.error} data-board-error>
              <ShellIcon name="alert" width={25} height={25} />
              <h2>โหลดรายการไม่สำเร็จ</h2>
              <p>ลองอีกครั้งเมื่อการเชื่อมต่อพร้อม</p>
              <button
                type="button"
                className={styles.textButton}
                onClick={refresh}
              >
                ลองอีกครั้ง <ShellIcon name="refresh" width={16} height={16} />
              </button>
            </div>
          ) : (
            <ReportTable
              rows={rows}
              type={view.type}
              loading={loading}
              searched={Boolean(view.q)}
              onOpen={setSelected}
            />
          )}
          <footer className={styles.pagination}>
            <span>
              {loading
                ? 'กำลังโหลด…'
                : failed
                  ? 'ยังแสดงรายการไม่ได้'
                  : rows.length
                    ? `รายการ ${view.page * REPORT_PAGE_SIZE + 1}–${view.page * REPORT_PAGE_SIZE + rows.length}`
                    : view.page
                      ? 'ไม่มีรายการในหน้านี้'
                      : '0 รายการ'}
            </span>
            <div>
              <button
                type="button"
                className={styles.pageButton}
                aria-label="หน้าก่อนหน้า"
                disabled={loading || !view.page}
                onClick={() =>
                  setView((value) => ({ ...value, page: value.page - 1 }))
                }
              >
                <ShellIcon
                  name="arrow"
                  width={15}
                  height={15}
                  style={{ transform: 'rotate(180deg)' }}
                />
                <span>ก่อนหน้า</span>
              </button>
              <span
                className={styles.pageNumber}
                aria-label={`หน้า ${view.page + 1}`}
              >
                {view.page + 1}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                aria-label="หน้าถัดไป"
                disabled={loading || failed || !state.hasNext}
                onClick={() =>
                  setView((value) => ({ ...value, page: value.page + 1 }))
                }
              >
                <span>ถัดไป</span>
                <ShellIcon name="arrow" width={15} height={15} />
              </button>
            </div>
          </footer>
        </div>
      </section>
      <p className={styles.boardFoot}>ของสำคัญ มีเจ้าของ</p>
      {selected !== null && (
        <ReportDetail
          key={selected}
          reportId={selected}
          showMatching={owned}
          onManaged={
            owned
              ? () => {
                  updated.current = true;
                }
              : undefined
          }
          onClose={() => {
            setSelected(null);
            if (updated.current) {
              updated.current = false;
              setView((value) => ({
                ...value,
                page: 0,
                revision: value.revision + 1,
              }));
              requestAnimationFrame(() => searchField.current?.focus());
            }
          }}
        />
      )}
    </div>
  );
}
