import type { MatchReader } from '../domain/match-reader';
export class MatchingService {
  constructor(private readonly reader: MatchReader) {}
  list(userId: number, before?: number) {
    return this.reader.listOwned(userId, before);
  }
}
