import styles from './javascript-notice.module.css';
export function JavascriptNotice() {
  return (
    <noscript>
      <p className={styles.notice}>กรุณาเปิด JavaScript เพื่อเข้าสู่ระบบ</p>
    </noscript>
  );
}
