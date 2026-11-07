import styles from './status.module.css';
export function StatusSkeleton() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>
          reunite<span>.</span>
        </span>
      </header>
      <p
        role="status"
        style={{
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '.8125rem',
        }}
      >
        กำลังเตรียมหน้า…
      </p>
      <main className={styles.main} aria-busy="true">
        <div aria-hidden="true">
          <div className={styles.skeletonBlock} style={{ height: 280 }} />
        </div>
        <div aria-hidden="true">
          <div
            className={styles.skeletonBlock}
            style={{ height: 22, width: '45%', marginBottom: 20 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 44, width: '90%', marginBottom: 20 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 70, marginBottom: 24 }}
          />
          <div
            className={styles.skeletonBlock}
            style={{ height: 48, width: 180 }}
          />
        </div>
      </main>
    </div>
  );
}
