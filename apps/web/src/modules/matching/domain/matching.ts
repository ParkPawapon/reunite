export const evidenceAttributes = [
  'object_type',
  'brand',
  'model',
  'color',
  'marking',
  'contents',
  'damage',
  'location',
  'time',
  'appearance',
] as const;
export type MatchAssessment = {
  decision: 'possible_match' | 'different_item' | 'insufficient_evidence';
  summary: string;
  evidence: {
    attribute: (typeof evidenceAttributes)[number];
    relation: 'agree' | 'conflict';
    detail: string;
  }[];
  missingEvidence: string[];
  imageComparison: 'both' | 'one' | 'none';
};
export type MatchItem = {
  title: string;
  description: string | null;
  category: string;
  location: string;
  eventDatetime: string;
  image: Uint8Array | null;
};
export type MatchJob = {
  matchId: number;
  leaseToken: string;
  lost: MatchItem;
  found: MatchItem;
};
export type ProviderResult = {
  assessment: MatchAssessment;
  model: string;
  responseId: string;
  estimatedUsdMicros: number;
};
export interface MatchingProvider {
  compare(job: MatchJob): Promise<ProviderResult>;
}
export interface MatchingQueue {
  reconcile(): Promise<void>;
  claim(
    budgetUsdMicros: number,
    reservationUsdMicros: number,
  ): Promise<MatchJob | null>;
  complete(job: MatchJob, result: ProviderResult): Promise<boolean>;
  fail(job: MatchJob, code: string, retryable: boolean): Promise<void>;
}

// Conservative display gate, not a calibrated probability or an ownership decision.
export function reviewAssessment(value: MatchAssessment): MatchAssessment {
  if (value.decision !== 'possible_match') return value;
  const identity = new Set(
    value.evidence
      .filter(
        (e) =>
          e.relation === 'agree' &&
          !['location', 'time', 'object_type'].includes(e.attribute),
      )
      .map((e) => e.attribute),
  );
  const distinctive = ['model', 'marking', 'contents', 'damage'].some((a) =>
    identity.has(a as (typeof evidenceAttributes)[number]),
  );
  if (
    value.evidence.some((e) => e.relation === 'conflict') ||
    identity.size < 2 ||
    !distinctive
  )
    return { ...value, decision: 'insufficient_evidence' };
  return value;
}
