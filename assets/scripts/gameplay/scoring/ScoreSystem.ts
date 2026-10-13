import { CellState } from '../../core/CellState';
import { GameConfig } from '../../config/GameConfig';


export class ScoreSystem {

    private total = 0;

    private streak = 0;
    private lastPlacementSeconds: number | null = null;


    get score(): number {
        return this.total;
    }

    get comboStreak(): number {
        return this.streak;
    }

    private tierScore(tier: number): number {
        return GameConfig.scoreStreakBaseTier + (tier - 1) * GameConfig.scoreStreakTierStep;
    }

  
    addForDog(cell: number, elapsedSeconds: number): number {
        const secondsSinceLast =
            this.lastPlacementSeconds === null ? Infinity : elapsedSeconds - this.lastPlacementSeconds;
        this.lastPlacementSeconds = elapsedSeconds;
        this.streak += 1;

        const gained = this.tierScore(this.streak) + this.speedBonusFor(secondsSinceLast);
        this.total += gained;
        return gained;
    }

  
    addForAssistedDog(cell: number): number {
        const gained = GameConfig.scoreStreakBaseTier;
        this.total += gained;
        return gained;
    }

    /** Ô còn Empty lúc thắng màn được tự động đánh dấu (xem PuzzleSession.autoMarkRemainingCells)
     * — thưởng CỐ ĐỊNH mỗi ô, không tính streak/speed bonus như addForDog() (không phải hành
     * động thật của người chơi). */
    addForAutoMark(cell: number): number {
        const gained = GameConfig.scoreAutoMarkBonus;
        this.total += gained;
        return gained;
    }

    resetStreak(): void {
        this.streak = 0;
    }

    reset(): void {
        this.total = 0;
        this.streak = 0;
        this.lastPlacementSeconds = null;
    }



    recomputeFrom(states: readonly CellState[]): number {
        this.total = 0;
        this.streak = 0;
        this.lastPlacementSeconds = null;

        let dogCount = 0;
        for (const state of states) {
            if (state === CellState.Dog) dogCount++;
        }
        this.total = dogCount * GameConfig.scoreStreakBaseTier;
        return this.total;
    }

    private speedBonusFor(secondsSinceLast: number): number {
        if (!Number.isFinite(secondsSinceLast)) return 0;

        const instant = GameConfig.scoreSpeedBonusInstantSeconds;
        if (secondsSinceLast <= instant) return GameConfig.scoreSpeedBonusMax;

        const decayed =
            GameConfig.scoreSpeedBonusMax -
            (secondsSinceLast - instant) * GameConfig.scoreSpeedBonusDecayPerSecond;
        return Math.max(0, Math.round(decayed));
    }
}
