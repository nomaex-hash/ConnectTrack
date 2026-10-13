
export class PuzzleTimer {
    private startMs = 0;
    private baseSeconds = 0;
    private frozenSeconds: number | null = null;

   
    start(baseSeconds = 0): void {
        this.baseSeconds = Math.max(0, baseSeconds);
        this.startMs = Date.now();
        this.frozenSeconds = null;
    }

    stop(): void {
        if (this.frozenSeconds === null) {
            this.frozenSeconds = this.elapsedSeconds;
        }
    }

    get elapsedSeconds(): number {
        if (this.frozenSeconds !== null) return this.frozenSeconds;
        if (this.startMs === 0) return this.baseSeconds;
        return this.baseSeconds + Math.max(0, Math.floor((Date.now() - this.startMs) / 1000));
    }

    get isRunning(): boolean {
        return this.startMs !== 0 && this.frozenSeconds === null;
    }
}
