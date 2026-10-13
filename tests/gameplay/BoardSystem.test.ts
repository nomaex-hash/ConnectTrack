import { describe, it, expect } from 'vitest';
import { BoardSystem } from '../../assets/scripts/gameplay/board/BoardSystem';
import { CellState } from '../../assets/scripts/core/CellState';
import { BoardSaveData } from '../../assets/scripts/model/BoardSaveData';
import {
    PUZZLE_4X4,
    PUZZLE_4X4_WITH_PREPLACED,
    PUZZLE_4X4_WITH_PREPLACED_MARK,
} from '../helpers/makePuzzle';

describe('BoardSystem — khởi tạo', () => {
    it('ván mới: mọi ô đều Empty', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        expect(board.cellCount).toBe(16);
        for (let i = 0; i < board.cellCount; i++) {
            expect(board.getState(i)).toBe(CellState.Empty);
        }
        expect(board.countDogs()).toBe(0);
    });

    it('áp pre-placed Dog và khóa ô đó', () => {
        const board = new BoardSystem(PUZZLE_4X4_WITH_PREPLACED);
        expect(board.getState(13)).toBe(CellState.Dog);
        expect(board.isLocked(13)).toBe(true);
        expect(board.countDogs()).toBe(1);
    });

    it('áp pre-placed Mark và khóa ô đó', () => {
        const board = new BoardSystem(PUZZLE_4X4_WITH_PREPLACED_MARK);
        expect(board.getState(0)).toBe(CellState.Mark);
        expect(board.isLocked(0)).toBe(true);
    });

    it('ô không pre-placed thì không bị khóa', () => {
        const board = new BoardSystem(PUZZLE_4X4_WITH_PREPLACED);
        expect(board.isLocked(0)).toBe(false);
    });
});

describe('BoardSystem — truy vấn tọa độ (row-major)', () => {
    const board = new BoardSystem(PUZZLE_4X4);

    it('row/col suy ra đúng từ chỉ số phẳng', () => {
        expect(board.rowOf(0)).toBe(0);
        expect(board.colOf(0)).toBe(0);
        expect(board.rowOf(6)).toBe(1);
        expect(board.colOf(6)).toBe(2);
        expect(board.rowOf(15)).toBe(3);
        expect(board.colOf(15)).toBe(3);
    });

    it('regionOf khớp bản đồ vùng màu', () => {
        expect(board.regionOf(0)).toBe(2);
        expect(board.regionOf(4)).toBe(0);
        expect(board.regionOf(13)).toBe(1);
    });

    it('isInBounds chặn chỉ số ngoài lưới', () => {
        expect(board.isInBounds(0)).toBe(true);
        expect(board.isInBounds(15)).toBe(true);
        expect(board.isInBounds(-1)).toBe(false);
        expect(board.isInBounds(16)).toBe(false);
        expect(board.isInBounds(1.5)).toBe(false);
    });
});

describe('BoardSystem — setState', () => {
    it('đổi trạng thái ô hợp lệ', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        expect(board.setState(5, CellState.Mark)).toBe(true);
        expect(board.getState(5)).toBe(CellState.Mark);
    });

    it('trả false khi không có thay đổi thật', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        expect(board.setState(5, CellState.Empty)).toBe(false);
    });

    it('TỪ CHỐI ghi lên ô bị khóa', () => {
        const board = new BoardSystem(PUZZLE_4X4_WITH_PREPLACED);
        expect(board.setState(13, CellState.Empty)).toBe(false);
        expect(board.getState(13)).toBe(CellState.Dog);
    });

    it('TỪ CHỐI ghi ra ngoài lưới', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        expect(board.setState(16, CellState.Mark)).toBe(false);
        expect(board.setState(-1, CellState.Mark)).toBe(false);
    });
});

describe('BoardSystem — Restart', () => {
    it('xóa mọi ô người chơi điền', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        board.setState(1, CellState.Mark);
        board.setState(2, CellState.Dog);
        board.setState(3, CellState.WrongMark);

        expect(board.resetToInitial()).toBe(true);

        expect(board.getState(1)).toBe(CellState.Empty);
        expect(board.getState(2)).toBe(CellState.Empty);
        expect(board.getState(3)).toBe(CellState.Empty);
        expect(board.countDogs()).toBe(0);
    });

    it('GIỮ NGUYÊN ô pre-placed', () => {
        const board = new BoardSystem(PUZZLE_4X4_WITH_PREPLACED);
        board.setState(2, CellState.Dog);

        board.resetToInitial();

        expect(board.getState(13)).toBe(CellState.Dog); // pre-placed, còn nguyên
        expect(board.getState(2)).toBe(CellState.Empty); // người chơi điền, bị xóa
        expect(board.countDogs()).toBe(1);
    });

    it('trả false khi board vốn đã sạch', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        expect(board.resetToInitial()).toBe(false);
    });
});

describe('BoardSystem — snapshot / restore', () => {
    it('xuất rồi nạp lại cho ra đúng từng ô', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        board.setState(2, CellState.Dog);
        board.setState(5, CellState.Mark);
        board.setState(9, CellState.WrongMark);

        const snapshot = board.createSnapshot('campaign', 1, null, 2, 42);
        expect(snapshot.mistakesRemaining).toBe(2);
        expect(snapshot.puzzleId).toBe(1);
        expect(snapshot.context).toBe('campaign');
        expect(snapshot.elapsedSeconds).toBe(42); // thời gian đã chơi đi kèm để resume

        const restored = new BoardSystem(PUZZLE_4X4);
        expect(restored.restoreFrom(snapshot)).toBe(true);

        expect(restored.getState(2)).toBe(CellState.Dog);
        expect(restored.getState(5)).toBe(CellState.Mark);
        expect(restored.getState(9)).toBe(CellState.WrongMark);
        expect(restored.getState(0)).toBe(CellState.Empty);
    });

    it('tập ô khóa dựng lại từ PuzzleData, KHÔNG lấy từ snapshot', () => {
        const board = new BoardSystem(PUZZLE_4X4_WITH_PREPLACED);
        board.setState(2, CellState.Dog);
        const snapshot = board.createSnapshot('campaign', 1, null, 3, 0);

        const restored = new BoardSystem(PUZZLE_4X4_WITH_PREPLACED);
        restored.restoreFrom(snapshot);

        expect(restored.isLocked(13)).toBe(true);
        expect(restored.setState(13, CellState.Empty)).toBe(false);
    });

    it('snapshot chứa bản SAO — sửa board sau đó không làm bẩn snapshot', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        board.setState(2, CellState.Dog);
        const snapshot = board.createSnapshot('campaign', 1, null, 3, 0);

        board.setState(5, CellState.Mark);

        expect(snapshot.cellStates[5]).toBe(CellState.Empty);
    });

    it('TỪ CHỐI snapshot sai kích thước bàn', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        const bad: BoardSaveData = {
            context: 'campaign',
            puzzleId: 1,
            puzzleDate: null,
            cellStates: [0, 1, 2],
            mistakesRemaining: 3,
            elapsedSeconds: 0,
        };
        expect(board.restoreFrom(bad)).toBe(false);
    });

    it('TỪ CHỐI snapshot có giá trị CellState lạ', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        const bad: BoardSaveData = {
            context: 'campaign',
            puzzleId: 1,
            puzzleDate: null,
            cellStates: new Array(16).fill(99),
            mistakesRemaining: 3,
            elapsedSeconds: 0,
        };
        expect(board.restoreFrom(bad)).toBe(false);
    });

    it('snapshot daily mang theo ngày', () => {
        const board = new BoardSystem(PUZZLE_4X4);
        const snapshot = board.createSnapshot('daily', 7, '2026-07-14', 3, 0);
        expect(snapshot.context).toBe('daily');
        expect(snapshot.puzzleDate).toBe('2026-07-14');
    });
});
