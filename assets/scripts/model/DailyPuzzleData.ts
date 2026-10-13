import { RankTier } from '../core/RankTier';


export interface DailyPuzzleData {
    lastDailyDate: string | null;
    lastDailySeconds: number | null;
    lastDailyScore: number | null;
    lastDailyRank: RankTier | null;

    streak: number;
    bestStreak: number;
    streakLastDate: string | null;
    streakAnchorDate: string | null;
    checkedDates: string[];
    rewardClaimedForAnchor: boolean;
}
