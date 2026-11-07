import styles from './shell.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerSignature}>
        <span lang="en">
          reunite<span>.</span>
        </span>
        <p>
          พาของสำคัญ
          <br className={styles.footerBreak} /> กลับไปหาคนสำคัญ
        </p>
      </div>
    </footer>
  );
}
