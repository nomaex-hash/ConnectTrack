import { PuzzleState } from '../../core/PuzzleState';


const ALLOWED: Readonly<Record<PuzzleState, readonly PuzzleState[]>> = {
    [PuzzleState.Loading]: [PuzzleState.Ready, PuzzleState.Disposed],
    [PuzzleState.Ready]: [PuzzleState.Playing, PuzzleState.Disposed],
    
    [PuzzleState.Playing]: [
        PuzzleState.Ready,
        PuzzleState.Solved,
        PuzzleState.Failed,
        PuzzleState.Disposed,
    ],
    [PuzzleState.Solved]: [PuzzleState.Disposed],
    [PuzzleState.Failed]: [PuzzleState.Disposed],
    [PuzzleState.Disposed]: [],
};

export class PuzzleStateMachine {
    private _state: PuzzleState = PuzzleState.Loading;

    get state(): PuzzleState {
        return this._state;
    }

    get acceptsIntent(): boolean {
        return this._state === PuzzleState.Ready || this._state === PuzzleState.Playing;
    }

    get isTerminal(): boolean {
        return this._state === PuzzleState.Solved || this._state === PuzzleState.Failed;
    }

    canTransition(to: PuzzleState): boolean {
        return ALLOWED[this._state].indexOf(to) >= 0;
    }

    transition(to: PuzzleState): boolean {
        if (to === this._state) return true;

        if (!this.canTransition(to)) {
            console.warn(`[PuzzleStateMachine] Transition không hợp lệ: ${this._state} -> ${to}.`);
            return false;
        }
        this._state = to;
        return true;
    }

   
    markPlaying(): void {
        if (this._state === PuzzleState.Ready) {
            this._state = PuzzleState.Playing;
        }
    }
}
