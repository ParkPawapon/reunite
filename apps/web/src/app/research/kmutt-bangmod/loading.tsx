import { CampusLoading } from './campus-loading';
import styles from './viewer.module.css';

export default function Loading() {
  return (
    <main className={styles.study}>
      <div className={styles.viewport}>
        <CampusLoading />
      </div>
    </main>
  );
}
