
export interface PuzzleData {
  
    readonly id: number;

    readonly size: number;

   
    readonly regions: readonly number[];

   
    readonly solution: readonly number[];


    readonly prePlacedDogs: readonly number[];


    readonly prePlacedMarks: readonly number[];
}
