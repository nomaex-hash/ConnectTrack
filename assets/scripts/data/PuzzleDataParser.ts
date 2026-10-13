import { PuzzleData } from '../model/PuzzleData';
import { solve } from '../editor/PuzzleValidator';


export class PuzzleDataError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PuzzleDataError';
    }
}

function readIntArray(raw: Record<string, unknown>, key: string): number[] {
    const value = raw[key];
    if (!Array.isArray(value)) {
        throw new PuzzleDataError(`Trường '${key}' phải là mảng.`);
    }
    for (const item of value) {
        if (!Number.isInteger(item)) {
            throw new PuzzleDataError(`Trường '${key}' chứa giá trị không phải số nguyên.`);
        }
    }
    return value as number[];
}

function readIntAlias(raw: Record<string, unknown>, keys: readonly string[]): number {
    for (const key of keys) {
        if (Number.isInteger(raw[key])) return raw[key] as number;
    }
    throw new PuzzleDataError(`Thiếu trường số nguyên (chấp nhận: ${keys.join(' / ')}).`);
}

function readIntArrayAlias(raw: Record<string, unknown>, keys: readonly string[]): number[] {
    for (const key of keys) {
        if (raw[key] !== undefined) return readIntArray(raw, key);
    }
    return [];
}

function assertCellIndices(indices: readonly number[], cellCount: number, key: string): void {
    for (const index of indices) {
        if (index < 0 || index >= cellCount) {
            throw new PuzzleDataError(`Trường '${key}' có chỉ số ô ${index} nằm ngoài lưới.`);
        }
    }
}



export function parsePuzzleData(raw: unknown, allowFewerRegions = false): PuzzleData {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new PuzzleDataError('Puzzle JSON không phải object.');
    }
    const obj = raw as Record<string, unknown>;

    const id = readIntAlias(obj, ['id', 'level']);

    const size = obj.size;
    if (!Number.isInteger(size) || (size as number) < 1) {
        throw new PuzzleDataError("Trường 'size' phải là số nguyên dương.");
    }
    const n = size as number;
    const cellCount = n * n;

    const regions = readIntArray(obj, 'regions');
    if (regions.length !== cellCount) {
        throw new PuzzleDataError(
            `'regions' có ${regions.length} phần tử, phải là ${cellCount} (size ${n}).`,
        );
    }

    const distinctRegions = new Set(regions).size;
    const regionsOk = allowFewerRegions ? distinctRegions <= n : distinctRegions === n;
    if (!regionsOk) {
        throw new PuzzleDataError(`Puzzle có ${distinctRegions} vùng màu, phải có đúng ${n}.`);
    }

    const solution = resolveSolution(obj, n, regions, cellCount);

    const prePlacedDogs = readIntArrayAlias(obj, ['prePlacedDogs', 'prePlacedQueens']);
    assertCellIndices(prePlacedDogs, cellCount, 'prePlacedDogs');
    for (const cell of prePlacedDogs) {
        if (solution.indexOf(cell) < 0) {
            throw new PuzzleDataError(
                `prePlacedDogs chứa ô ${cell} không nằm trong solution — puzzle tự mâu thuẫn.`,
            );
        }
    }

    const prePlacedMarks = readIntArrayAlias(obj, ['prePlacedMarks', 'prePlacedCrosses']);
    assertCellIndices(prePlacedMarks, cellCount, 'prePlacedMarks');
    for (const cell of prePlacedMarks) {
        if (solution.indexOf(cell) >= 0) {
            throw new PuzzleDataError(
                `prePlacedMarks chứa ô ${cell} nằm trong solution — ô đúng bị khóa thành Mark.`,
            );
        }
    }

    return { id, size: n, regions, solution, prePlacedDogs, prePlacedMarks };
}


function resolveSolution(
    obj: Record<string, unknown>,
    n: number,
    regions: readonly number[],
    cellCount: number,
): number[] {
    if (obj.solution !== undefined) {
        const solution = readIntArray(obj, 'solution');
        if (solution.length !== n) {
            throw new PuzzleDataError(`'solution' có ${solution.length} Dog, phải có đúng ${n}.`);
        }
        assertCellIndices(solution, cellCount, 'solution');
        return solution;
    }


    const found = solve(n, regions, n, 2);
    if (found.length === 0) {
        throw new PuzzleDataError('Puzzle VÔ NGHIỆM — không thể tự tính solution để chơi.');
    }
    if (found.length > 1) {
        throw new PuzzleDataError(
            'Puzzle có TỪ 2 NGHIỆM TRỞ LÊN — không dùng được (sẽ làm hỏng bàn chơi).',
        );
    }
    return found[0];
}
