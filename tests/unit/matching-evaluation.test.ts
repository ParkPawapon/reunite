import { it, expect } from 'vitest';
import { evaluateMatching } from '@/modules/matching/domain/evaluation';
import type { MatchAssessment } from '@/modules/matching/domain/matching';
const positive: MatchAssessment = {
  decision: 'possible_match',
  summary: 'Synthetic evaluation result',
  evidence: [
    { attribute: 'model', relation: 'agree', detail: 'same' },
    { attribute: 'damage', relation: 'agree', detail: 'same' },
  ],
  missingEvidence: [],
  imageComparison: 'none',
};
it('reports precision/recall and counts abstention on a true pair as a missed match', () => {
  expect(
    evaluateMatching([
      { sameItem: true, assessment: positive },
      { sameItem: false, assessment: positive },
      {
        sameItem: true,
        assessment: { ...positive, decision: 'insufficient_evidence' },
      },
      {
        sameItem: false,
        assessment: { ...positive, decision: 'different_item' },
      },
    ]),
  ).toMatchObject({
    truePositives: 1,
    falsePositives: 1,
    falseNegatives: 1,
    trueNegatives: 1,
    abstentions: 1,
    precision: 0.5,
    recall: 0.5,
  });
});
it('uses null when there is no denominator and never reports invented accuracy', () => {
  expect(evaluateMatching([])).toMatchObject({
    total: 0,
    precision: null,
    recall: null,
  });
});
