import { LevelProgressData } from './LevelProgressData';
import { DailyPuzzleData } from './DailyPuzzleData';
import { GameSettingsData } from './GameSettingsData';
import { BoardSaveData } from './BoardSaveData';
import { ShopIAPSaveData } from './ShopIAPSaveData';
import { LeaderboardDataSave } from './LeaderboardDataSave';
import { ProfileSaveData } from './ProfileSaveData';


export interface PlayerData {
    progression: LevelProgressData;
    daily: DailyPuzzleData;
    inventory: {
        placeDogCharges: number;
        hintCharges: number;
        coin: number;
    };
    settings: GameSettingsData;
    boardInProgress: BoardSaveData | null;

    hasSeenTutorial: boolean;

    shopPurchases: ShopIAPSaveData;
    leaderboardState: LeaderboardDataSave;
    profile: ProfileSaveData;
}
