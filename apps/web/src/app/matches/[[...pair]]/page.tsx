import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/modules/auth/presentation/require-page-user';
import { AppShell } from '@/components/shell/app-shell';
import { MatchReturnExperience } from '@/components/matching/match-return-experience';
import styles from '@/components/matching/match-return.module.css';
import { services } from '@/lib/composition';
import { idSchema } from '@/lib/http/api';

export const metadata: Metadata = { title: 'จับคู่สิ่งของ · Reunite' };

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ pair?: string[] }>;
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  const { pair } = await params;
  const match = pair && idSchema.safeParse(pair[0]);
  const before = idSchema.safeParse((await searchParams).before);
  const path = match?.success ? `/matches/${match.data}` : '/matches';
  const user = await requirePageUser(
    before.success ? `${path}?before=${before.data}` : path,
  );
  if (pair && (pair.length !== 1 || !match?.success)) notFound();
  const profile = await services().profile.get(user.userId);
  const inbox = await services().matching.list(
    user.userId,
    before.success ? before.data : undefined,
  );

  return (
    <AppShell
      page="matches"
      user={{
        name: user.name,
        email: user.email,
        avatarVersion: profile.avatarVersion,
      }}
    >
      <section className={styles.workspace}>
        <h1>สิ่งของที่อาจตรงกัน</h1>
        {inbox.items.length ? (
          <ul className={styles.inbox}>
            {inbox.items.map((pair) => (
              <li key={pair.matchId}>
                <Link href={`/matches/${pair.matchId}`}>
                  <strong>{pair.ownTitle}</strong>
                  <span>{pair.candidateTitle}</span>
                  <span>{pair.assessment.summary}</span>
                  <span className={styles.inboxAction}>ดูทั้งสองประกาศ</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>ยังไม่มีคู่ที่รอตรวจสอบ</p>
        )}
        {inbox.nextCursor && (
          <Link href={`/matches?before=${inbox.nextCursor}`}>
            ดูก่อนหน้านี้
          </Link>
        )}
      </section>
      {match?.success && (
        <MatchReturnExperience key={match.data} matchId={match.data} />
      )}
    </AppShell>
  );
}
