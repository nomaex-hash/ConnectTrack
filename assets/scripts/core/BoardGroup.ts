
export enum BoardGroupKind {
    Row = 'Row',
    Column = 'Column',
    Region = 'Region',
}

export interface BoardGroup {
    readonly kind: BoardGroupKind;
    readonly index: number;
}

export interface AdjacencyConflict {
    readonly cell: number;
}


export interface WrongReason {
    readonly groups: readonly BoardGroup[];
    readonly adjacent: readonly AdjacencyConflict[];
}
