

export interface RawPuzzle {
    readonly id: number;
    readonly size: number;
    readonly regions: readonly number[];
    readonly solution?: readonly number[];
    readonly prePlacedDogs?: readonly number[];
    readonly prePlacedMarks?: readonly number[];
}

export interface ValidationResult {
    readonly valid: boolean;
    readonly errors: readonly string[];
    readonly solutions: readonly (readonly number[])[];
}



export function solve(
    size: number,
    regions: readonly number[],
    targetCount: number,
    cap = 2,
): number[][] {
    const regionAt = (row: number, col: number): number => regions[row * size + col];

    const solutions: number[][] = [];
    const usedCols = new Set<number>();
    const usedRegions = new Set<number>();
    const placed: Array<[number, number]> = [];

    const canPlace = (row: number, col: number): boolean => {
        if (usedCols.has(col)) return false;
        if (usedRegions.has(regionAt(row, col))) return false;
        for (const [pRow, pCol] of placed) {
            if (Math.abs(pRow - row) <= 1 && Math.abs(pCol - col) <= 1) return false;
        }
        return true;
    };

    const search = (row: number): void => {
        if (solutions.length >= cap) return;
        if (placed.length === targetCount) {
            solutions.push(placed.map(([r, c]) => r * size + c).sort((a, b) => a - b));
            return;
        }
        if (row === size) return;

        search(row + 1);
        if (solutions.length >= cap) return;

        for (let col = 0; col < size; col++) {
            if (!canPlace(row, col)) continue;
            const region = regionAt(row, col);
            usedCols.add(col);
            usedRegions.add(region);
            placed.push([row, col]);

            search(row + 1);

            placed.pop();
            usedRegions.delete(region);
            usedCols.delete(col);
            if (solutions.length >= cap) return;
        }
    };

    search(0);
    return solutions;
}

export function isValidSolution(
    size: number,
    regions: readonly number[],
    solution: readonly number[],
): boolean {
    if (solution.length < 1 || solution.length > size) return false;

    const rows = new Set<number>();
    const cols = new Set<number>();
    const regionIds = new Set<number>();

    for (const index of solution) {
        rows.add(Math.floor(index / size));
        cols.add(index % size);
        regionIds.add(regions[index]);
    }
   
    if (
        rows.size !== solution.length ||
        cols.size !== solution.length ||
        regionIds.size !== solution.length
    ) {
        return false;
    }

    for (let i = 0; i < solution.length; i++) {
        for (let j = i + 1; j < solution.length; j++) {
            const rowA = Math.floor(solution[i] / size);
            const colA = solution[i] % size;
            const rowB = Math.floor(solution[j] / size);
            const colB = solution[j] % size;
            if (Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1) return false;
        }
    }
    return true;
}

export function regionsAreContiguous(size: number, regions: readonly number[]): boolean {
    const byRegion = new Map<number, number[]>();
    for (let i = 0; i < regions.length; i++) {
        const list = byRegion.get(regions[i]);
        if (list) list.push(i);
        else byRegion.set(regions[i], [i]);
    }

    for (const cells of byRegion.values()) {
        const set = new Set(cells);
        const seen = new Set<number>([cells[0]]);
        const stack = [cells[0]];
        while (stack.length > 0) {
            const c = stack.pop()!;
            const r = Math.floor(c / size);
            const col = c % size;
            const neigh: number[] = [];
            if (r > 0) neigh.push(c - size);
            if (r < size - 1) neigh.push(c + size);
            if (col > 0) neigh.push(c - 1);
            if (col < size - 1) neigh.push(c + 1);
            for (const nb of neigh) {
                if (set.has(nb) && !seen.has(nb)) {
                    seen.add(nb);
                    stack.push(nb);
                }
            }
        }
        if (seen.size !== cells.length) return false;
    }
    return true;
}

export function validatePuzzle(puzzle: RawPuzzle): ValidationResult {
    const errors: string[] = [];
    const { size, regions } = puzzle;

    if (!Number.isInteger(size) || size < 1) {
        return { valid: false, errors: ["'size' phải là số nguyên dương."], solutions: [] };
    }
    if (regions.length !== size * size) {
        return {
            valid: false,
            errors: [`'regions' có ${regions.length} phần tử, phải là ${size * size}.`],
            solutions: [],
        };
    }

    const distinctRegions = new Set(regions).size;
    if (distinctRegions !== size) {
        errors.push(`Có ${distinctRegions} vùng màu, phải có đúng ${size}.`);
        return { valid: false, errors, solutions: [] };
    }
    if (!regionsAreContiguous(size, regions)) {
        errors.push('Có vùng màu KHÔNG liền khối — cùng một màu bị tách thành nhiều khối.');
    }

    // Số chó mục tiêu = độ dài solution khai báo trong file (KHÔNG bắt buộc = size).
    // Thiếu solution thì coi như kiểu cũ (phủ hết mọi hàng), giữ tương thích ngược.
    const targetCount = puzzle.solution ? puzzle.solution.length : size;
    const solutions = solve(size, regions, targetCount, 2);
    if (solutions.length === 0) {
        errors.push('Puzzle VÔ NGHIỆM — người chơi không thể hoàn thành.');
    } else if (solutions.length > 1) {
        errors.push('Puzzle có TỪ 2 NGHIỆM TRỞ LÊN — sẽ làm hỏng bàn chơi vĩnh viễn.');
    }

    if (puzzle.solution && solutions.length === 1) {
        if (!isValidSolution(size, regions, puzzle.solution)) {
            errors.push('Trường solution trong file không thỏa 4 luật của puzzle.');
        } else {
            const baked = puzzle.solution.slice().sort((a, b) => a - b).join(',');
            if (baked !== solutions[0].join(',')) {
                errors.push('Trường solution trong file khác với nghiệm thật.');
            }
        }
    }

    if (puzzle.solution) {
        for (const cell of puzzle.prePlacedDogs ?? []) {
            if (puzzle.solution.indexOf(cell) < 0) {
                errors.push(`prePlacedDogs chứa ô ${cell} không nằm trong solution.`);
            }
        }
        for (const cell of puzzle.prePlacedMarks ?? []) {
            if (puzzle.solution.indexOf(cell) >= 0) {
                errors.push(`prePlacedMarks chứa ô ${cell} NẰM TRONG solution — khóa mất ô đúng.`);
            }
        }
    }

    return { valid: errors.length === 0, errors, solutions };
}
