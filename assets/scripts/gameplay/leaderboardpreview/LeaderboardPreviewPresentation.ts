
export interface LeaderboardPreviewSnapshot {
    readonly oldScore: number;
    readonly newScore: number;
}

export class LeaderboardPreviewPresentation {
    private static _pending: LeaderboardPreviewSnapshot | null = null;

    static request(oldScore: number, newScore: number): void {
        this._pending = { oldScore, newScore };
    }

    static isPending(): boolean {
        return this._pending !== null;
    }


    static peek(): LeaderboardPreviewSnapshot | null {
        return this._pending;
    }

    static consume(): LeaderboardPreviewSnapshot | null {
        const value = this._pending;
        this._pending = null;
        return value;
    }
}
