
export class MistakeCounter {
    private _remaining: number;

    constructor(readonly max: number) {
        this._remaining = max;
    }

    get remaining(): number {
        return this._remaining;
    }

    get isExhausted(): boolean {
        return this._remaining <= 0;
    }

   
    consume(): number {
        if (this._remaining > 0) this._remaining--;
        return this._remaining;
    }

   
    reset(): void {
        this._remaining = this.max;
    }

 
    restore(remaining: number): void {
        this._remaining = Math.max(0, Math.min(this.max, remaining));
    }
}
