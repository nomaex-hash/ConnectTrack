import { describe, it, expect } from 'vitest';
import { HintSystem } from '../../assets/scripts/gameplay/assist/HintSystem';
import { BoardSystem } from '../../assets/scripts/gameplay/board/BoardSystem';
import { CellState } from '../../assets/scripts/core/CellState';
import { BoardGroupKind } from '../../assets/scripts/core/BoardGroup';
import { PUZZLE_4X4 } from '../helpers/makePuzzle';

// PUZZLE_4X4: solution = [2, 4, 11, 13]
//   regions:  2 2 2 2      solution:  . . D .
//             0 3 2 3                 D . . .
//             3 3 3 3                 . . . D
//             3 1 1 3                 . D . .
const SOLUTION = [2, 4, 11, 13];

function freshBoard(): BoardSystem {
    return new BoardSystem(PUZZLE_4X4);
}

describe('HintSystem', () => {
    it('board trống: vẫn đưa ra được gợi ý', () => {
        const hints = new HintSystem(SOLUTION);
        const hint = hints.getHint(freshBoard());
        expect(hint).not.toBeNull();
    });

    it('tất định: cùng thế cờ luôn cho cùng gợi ý', () => {
        const hints = new HintSystem(SOLUTION);
        const a = hints.getHint(freshBoard());
        const b = hints.getHint(freshBoard());
        expect(a).toEqual(b);
    });

    it('gợi ý luôn trỏ vào nhóm CHƯA có Dog', () => {
        const hints = new HintSystem(SOLUTION);
        const board = freshBoard();
        board.setState(2, CellState.Dog); // row 0, col 2, region 2

        const hint = hints.getHint(board);
        expect(hint).not.toBeNull();

        if (hint!.kind === BoardGroupKind.Row) expect(hint!.index).not.toBe(0);
        if (hint!.kind === BoardGroupKind.Column) expect(hint!.index).not.toBe(2);
        if (hint!.kind === BoardGroupKind.Region) expect(hint!.index).not.toBe(2);
    });

    it('phát hiện nhóm bị ép buộc: chỉ còn đúng 1 ô khả dĩ', () => {
        const hints = new HintSystem(SOLUTION);
        const board = freshBoard();
        // Đặt 3/4 Dog đúng. Dog cuối (ô 13) là ô duy nhất còn khả dĩ.
        board.setState(2, CellState.Dog);
        board.setState(4, CellState.Dog);
        board.setState(11, CellState.Dog);

        const hint = hints.getHint(board);
        expect(hint).not.toBeNull();

        // Nhóm được gợi ý phải chứa ô 13 (row 3, col 1, region 1).
        const row = Math.floor(13 / 4);
        const col = 13 % 4;
        const region = PUZZLE_4X4.regions[13];
        const matches =
            (hint!.kind === BoardGroupKind.Row && hint!.index === row) ||
            (hint!.kind === BoardGroupKind.Column && hint!.index === col) ||
            (hint!.kind === BoardGroupKind.Region && hint!.index === region);
        expect(matches).toBe(true);
    });

    it('mọi Dog đã đặt xong → không còn gì để gợi ý', () => {
        const hints = new HintSystem(SOLUTION);
        const board = freshBoard();
        for (const cell of SOLUTION) board.setState(cell, CellState.Dog);

        expect(hints.getHint(board)).toBeNull();
    });

    it('KHÔNG giữ state: gọi nhiều lần liên tiếp cho cùng kết quả', () => {
        const hints = new HintSystem(SOLUTION);
        const board = freshBoard();

        const first = hints.getHint(board);
        const second = hints.getHint(board);
        const third = hints.getHint(board);

        expect(second).toEqual(first);
        expect(third).toEqual(first);
    });

    it('WrongMark loại ô đó khỏi tập khả dĩ', () => {
        const hints = new HintSystem(SOLUTION);
        const board = freshBoard();
        board.setState(0, CellState.WrongMark);

        // Không crash, vẫn ra gợi ý hợp lệ.
        expect(hints.getHint(board)).not.toBeNull();
    });
});
