export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { startMatching } =
      await import('./modules/matching/infrastructure/start-matching');
    startMatching();
  }
}
