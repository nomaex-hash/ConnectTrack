import { LevelProgressData } from '../../model/LevelProgressData';
import { LevelListConfig } from '../../config/LevelListConfig';


export class ProgressionSystem {
    constructor(private readonly data: LevelProgressData) {}

    get totalLevels(): number {
        return LevelListConfig.campaignLevelCount;
    }

    get completedCount(): number {
        return this.clampedHighest;
    }

    isCompleted(levelId: number): boolean {
        return levelId >= 1 && levelId <= this.clampedHighest;
    }


    getCurrentLevel(): number {
        return this.clampedHighest + 1;
    }

    isUnlocked(levelId: number): boolean {
        if (levelId < 1) return false;
        return levelId <= this.clampedHighest + 1;
    }

    markCompleted(levelId: number): number | null {
        if (levelId < 1) return null;
        if (levelId <= this.clampedHighest) return null; // đã qua rồi

        this.data.highestLevel = levelId;
        return this.getCurrentLevel();
    }

    private get clampedHighest(): number {
        const value = this.data.highestLevel;
        if (!isFinite(value) || value < 0) return 0;
        return Math.floor(value);
    }
}
