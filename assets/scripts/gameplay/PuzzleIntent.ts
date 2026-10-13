
export enum IntentType {
    ToggleMark = 'ToggleMark',
    DragMark = 'DragMark',
    PlaceDogAttempt = 'PlaceDogAttempt',
    UsePlaceDog = 'UsePlaceDog',
    ShowHint = 'ShowHint',
    ApplyHint = 'ApplyHint',
    Restart = 'Restart',
}

export type DragMode = 'mark' | 'erase';

export interface ToggleMarkIntent {
    readonly type: IntentType.ToggleMark;
    readonly cell: number;
}

export interface DragMarkIntent {
    readonly type: IntentType.DragMark;
    readonly cells: readonly number[];
    readonly mode: DragMode;
}

export interface PlaceDogAttemptIntent {
    readonly type: IntentType.PlaceDogAttempt;
    readonly cell: number;
}

export interface UsePlaceDogIntent {
    readonly type: IntentType.UsePlaceDog;
}

export interface ShowHintIntent {
    readonly type: IntentType.ShowHint;
}

export interface ApplyHintIntent {
    readonly type: IntentType.ApplyHint;
}

export interface RestartIntent {
    readonly type: IntentType.Restart;
}

export type PuzzleIntent =
    | ToggleMarkIntent
    | DragMarkIntent
    | PlaceDogAttemptIntent
    | UsePlaceDogIntent
    | ShowHintIntent
    | ApplyHintIntent
    | RestartIntent;
