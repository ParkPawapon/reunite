import { readFile } from 'node:fs/promises';
import { parseEvaluationInput } from '../apps/web/src/modules/matching/infrastructure/evaluation-input';
import { evaluateMatching } from '../apps/web/src/modules/matching/domain/evaluation';
const path = process.argv[2];
try {
  if (!path)
    throw new Error(
      'Usage: bun run matching:evaluate <private-labelled-results.json>',
    );
  const rows = parseEvaluationInput(JSON.parse(await readFile(path, 'utf8')));
  process.stdout.write(`${JSON.stringify(evaluateMatching(rows), null, 2)}\n`);
} catch {
  process.stderr.write(
    'Provide a valid, non-empty labelled results JSON with unique IDs; see docs/MATCHING.md.\n',
  );
  process.exitCode = 1;
}
