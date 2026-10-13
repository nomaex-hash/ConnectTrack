export const MAX_MISTAKES = 3;

/** Immutable mistake count. Reaching MAX_MISTAKES means the session is lost. */
export class MistakeCounter {
    private constructor(readonly count: number) {}

    static initial(): MistakeCounter {
        return new MistakeCounter(0);
    }

    recordMistake(): MistakeCounter {
        return new MistakeCounter(Math.min(this.count + 1, MAX_MISTAKES));
    }

    get isLost(): boolean {
        return this.count >= MAX_MISTAKES;
    }
}
