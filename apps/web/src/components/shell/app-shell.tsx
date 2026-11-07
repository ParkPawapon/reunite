'use client';
import { useState, type ReactNode } from 'react';
import Drawer from '@mui/material/Drawer';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useMotionPolicy } from '@/components/loading/use-motion-policy';
import { Sidebar } from './sidebar';
import { Topbar, type ShellUser } from './topbar';
import { Footer } from './footer';
import { ShellMotionProvider } from './shell-motion';
import styles from './shell.module.css';

export function AppShell({
  user,
  children,
  loading = false,
  page = 'dashboard',
}: {
  user?: ShellUser;
  children: ReactNode;
  loading?: boolean;
  page?: 'dashboard' | 'profile';
}) {
  const desktop = useMediaQuery('(min-width: 1000px)');
  const [compact, setCompact] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [paused, setPaused] = useState(false);
  const { visible, reducedMotion } = useMotionPolicy();
  const running = visible && !reducedMotion && !paused;
  return (
    <ShellMotionProvider value={running}>
      <div
        className={styles.shell}
        data-shell
        data-compact={compact}
        data-shell-motion={running ? 'running' : 'still'}
        data-reduced-motion={reducedMotion}
      >
        <a className={styles.skipLink} href="#main-content">
          ข้ามไปยังเนื้อหา
        </a>
        <aside className={styles.desktopSidebar} id="desktop-navigation">
          <Sidebar compact={compact} page={page} />
        </aside>
        <Drawer
          anchor="left"
          open={drawer && !desktop}
          onClose={() => setDrawer(false)}
          transitionDuration={reducedMotion ? 0 : { enter: 240, exit: 200 }}
          ModalProps={{ keepMounted: true }}
          slotProps={{
            transition: {
              easing: {
                enter: 'cubic-bezier(.22,1,.36,1)',
                exit: 'cubic-bezier(.4,0,.2,1)',
              },
            },
            paper: {
              id: 'mobile-navigation',
              role: 'dialog',
              'aria-label': 'เมนูนำทาง',
              sx: { width: 280, maxWidth: '86vw' },
            },
          }}
        >
          <Sidebar
            page={page}
            onClose={() => setDrawer(false)}
            onNavigate={() => setDrawer(false)}
          />
        </Drawer>
        <div className={styles.workspace}>
          <Topbar
            title={page === 'profile' ? 'โปรไฟล์' : 'ภาพรวม'}
            user={user}
            menuExpanded={desktop ? !compact : drawer}
            menuId={desktop ? 'desktop-navigation' : 'mobile-navigation'}
            menuLabel={
              desktop
                ? compact
                  ? 'ขยายเมนู'
                  : 'ย่อเมนู'
                : drawer
                  ? 'ปิดเมนู'
                  : 'เปิดเมนู'
            }
            reducedMotion={reducedMotion}
            onMenu={() => {
              if (desktop) setCompact((value) => !value);
              else setDrawer((value) => !value);
            }}
            paused={paused}
            onPause={() => setPaused((value) => !value)}
          />
          {loading && (
            <p role="status" className={styles.srOnly}>
              {page === 'profile'
                ? 'กำลังโหลดโปรไฟล์…'
                : 'กำลังเตรียม Dashboard…'}
            </p>
          )}
          <main
            id="main-content"
            tabIndex={-1}
            className={styles.content}
            aria-busy={loading}
          >
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </ShellMotionProvider>
  );
}
