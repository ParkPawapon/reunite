import { reviewAssessment, type MatchAssessment } from './matching';
export function evaluateMatching(
  rows: { sameItem: boolean; assessment: MatchAssessment }[],
) {
  let truePositives = 0,
    falsePositives = 0,
    falseNegatives = 0,
    trueNegatives = 0,
    abstentions = 0;
  for (const row of rows) {
    const decision = reviewAssessment(row.assessment).decision;
    const positive = decision === 'possible_match';
    if (decision === 'insufficient_evidence') abstentions++;
    if (positive && row.sameItem) truePositives++;
    else if (positive) falsePositives++;
    else if (row.sameItem) falseNegatives++;
    else trueNegatives++;
  }
  return {
    total: rows.length,
    truePositives,
    falsePositives,
    falseNegatives,
    trueNegatives,
    abstentions,
    precision:
      truePositives + falsePositives
        ? truePositives / (truePositives + falsePositives)
        : null,
    recall:
      truePositives + falseNegatives
        ? truePositives / (truePositives + falseNegatives)
        : null,
  };
}
