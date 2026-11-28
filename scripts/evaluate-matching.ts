import { readFile } from 'node:fs/promises';
import { parseEvaluationInput } from '../apps/web/src/modules/matching/infrastructure/evaluation-input';
import { evaluateMatching } from '../apps/web/src/modules/matching/domain/evaluation';
import { reviewAssessment } from '../apps/web/src/modules/matching/domain/matching';
import { scoreTextPairForQueue } from '../apps/web/src/modules/matching/domain/text-similarity';
import { matchingScenarios } from './fixtures/matching-evaluation';
const path = process.argv[2];
try {
  if (!path)
    throw new Error(
      'Usage: bun run matching:evaluate <private-labelled-results.json> | --synthetic',
    );
  const synthetic = path === '--synthetic';
  const rejected = synthetic
    ? new Set(
        matchingScenarios
          .filter(
            ({ lost, found }) => scoreTextPairForQueue(lost, found).fastReject,
          )
          .map(({ id }) => id),
      )
    : new Set<string>();
  const rows = synthetic
    ? matchingScenarios.map(({ id, sameItem, assessment }) => ({
        id,
        sameItem,
        assessment: rejected.has(id)
          ? { ...assessment, decision: 'different_item' as const }
          : assessment,
      }))
    : parseEvaluationInput(JSON.parse(await readFile(path, 'utf8')));
  const mistakes = rows.flatMap(({ id, sameItem, assessment }) => {
    const suggested =
      reviewAssessment(assessment).decision === 'possible_match';
    return sameItem === suggested
      ? []
      : [{ id, outcome: suggested ? 'false_positive' : 'false_negative' }];
  });
  const results = {
    dataset: synthetic
      ? 'fictional items and simulated provider assessments'
      : 'supplied provider assessments',
    ...evaluateMatching(rows),
    mistakes,
    ...(synthetic
      ? {
          prefilter: {
            rejected: rejected.size,
            missedSameItemIds: matchingScenarios
              .filter(({ id, sameItem }) => sameItem && rejected.has(id))
              .map(({ id }) => id),
          },
        }
      : {}),
  };
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} catch {
  process.stderr.write(
    'Provide a valid, non-empty labelled results JSON with unique IDs; see docs/MATCHING.md.\n',
  );
  process.exitCode = 1;
}
