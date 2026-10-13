import { RankTier } from '../core/RankTier';


export interface DailyResult {
    readonly date: string;
    readonly seconds: number;
    readonly score: number;
    readonly dogCount: number;
    readonly rank: RankTier;
    readonly streak: number;
    readonly bestStreak: number;
    readonly praiseText: string;
}
