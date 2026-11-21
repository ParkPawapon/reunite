import { AppError } from '@campus/shared';
import type {
  MatchReturnRepository,
  MatchRevision,
} from '../domain/match-return';

export class MatchReturnService {
  constructor(private readonly repository: MatchReturnRepository) {}

  async get(matchId: number, userId: number) {
    const result = await this.repository.find(matchId, userId);
    if (!result) throw new AppError('NOT_FOUND', 404, 'Match not found');
    return result;
  }

  confirm(matchId: number, userId: number, revision: MatchRevision) {
    return this.repository.confirm(matchId, userId, revision);
  }
}
