import { RankTier } from '../core/RankTier';


export const DAILY_CHALLENGE_SOLVED_EVENT = 'DailyChallengeSolvedEvent';

export interface DailyChallengeSolvedEventPayload {
    readonly date: string; // YYYY-MM-DD
    readonly seconds: number;
    readonly score: number;
    readonly dogCount: number;
    readonly rank: RankTier;
    readonly streak: number;
    readonly bestStreak: number;
}
