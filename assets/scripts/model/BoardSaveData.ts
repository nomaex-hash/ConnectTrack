
export type PuzzleContext = 'campaign' | 'daily' | 'tutorial';


export interface BoardSaveData {
    context: PuzzleContext;

   
    puzzleId: number;

 
    puzzleDate: string | null;

    
    cellStates: number[];

    mistakesRemaining: number;

    elapsedSeconds: number;
}
