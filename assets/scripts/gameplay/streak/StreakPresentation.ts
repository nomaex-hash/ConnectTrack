
export class StreakPresentation {
    private static _celebrate = false;

    static requestCelebrate(): void {
        this._celebrate = true;
    }

    static consumeCelebrate(): boolean {
        const value = this._celebrate;
        this._celebrate = false;
        return value;
    }

    static isPending(): boolean {
        return this._celebrate;
    }
}
