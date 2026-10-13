import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PuzzleSession } from '../../assets/scripts/gameplay/PuzzleSession';
import { IntentType } from '../../assets/scripts/gameplay/PuzzleIntent';
import { CellState } from '../../assets/scripts/core/CellState';
import { EventManager } from '../../assets/scripts/core/EventManager';
import {
    createDefaultSaveData,
    serializeSaveData,
    deserializeSaveData,
} from '../../assets/scripts/data/SaveDataSerializer';
import { PUZZLE_4X4, PUZZLE_4X4_WITH_PREPLACED } from '../helpers/makePuzzle';

/**
 * Vòng đời save đầy đủ (08 — mục 6.2): chơi → snapshot → serialize → storage giả →
 * deserialize → resume. Đây là đường đi thật của dữ liệu khi OS kill app giữa ván.
 *
 * Test này KHÔNG dựng SaveManager/GameManager (chúng là Cocos Component, cần engine) —
 * nó đi qua đúng chuỗi biến đổi dữ liệu mà hai manager đó điều phối.
 */

const SOLUTION = [2, 4, 11, 13];
const WRONG_CELL = 0;

/** Storage giả — thay cho localStorage. */
class FakeStorage {
    private value: string | null = null;
    write(json: string): void {
        this.value = json;
    }
    read(): string | null {
        return this.value;
    }
}

let storage: FakeStorage;

beforeEach(() => {
    storage = new FakeStorage();
});

afterEach(() => {
    // Session không đăng ký listener nào, nhưng dọn cho chắc — tránh rò rỉ giữa các test.
    EventManager.instance.targetOff(storage);
});

/** Mô phỏng đúng việc SaveManager làm: gắn snapshot vào document rồi ghi nguyên tử. */
function persist(session: PuzzleSession | null, storage: FakeStorage, previous?: string): void {
    const doc = previous ? deserializeSaveData(previous) : createDefaultSaveData();
    doc.playerData.boardInProgress = session ? session.createSnapshot() : null;
    storage.write(serializeSaveData(doc));
}

describe('Vòng đời save → resume', () => {
    it('chơi vài nước → lưu → đọc lại → resume ra ĐÚNG trạng thái cũ', () => {
        const session = new PuzzleSession({
            puzzle: PUZZLE_4X4,
            context: 'campaign',
            puzzleDate: null,
            placeDogCharges: 3,
            hintCharges: 3,
        });

        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: SOLUTION[0] }); // Dog
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: WRONG_CELL }); // Wrong, -1
        session.dispatch({ type: IntentType.ToggleMark, cell: 5 }); // Mark

        persist(session, storage);

        // --- OS kill app ở đây. Mở lại: ---

        const loaded = deserializeSaveData(storage.read()!);
        const snapshot = loaded.playerData.boardInProgress;
        expect(snapshot).not.toBeNull();
        expect(snapshot!.puzzleId).toBe(PUZZLE_4X4.id);
        expect(snapshot!.context).toBe('campaign');

        const resumed = new PuzzleSession({
            puzzle: PUZZLE_4X4,
            context: 'campaign',
            puzzleDate: null,
            placeDogCharges: loaded.playerData.inventory.placeDogCharges,
            hintCharges: 3,
            snapshot,
        });

        expect(resumed.cellStates[SOLUTION[0]]).toBe(CellState.Dog);
        expect(resumed.cellStates[WRONG_CELL]).toBe(CellState.WrongMark);
        expect(resumed.cellStates[5]).toBe(CellState.Mark);
        expect(resumed.mistakesRemaining).toBe(2);

        // Chơi tiếp được ngay, không phải làm lại từ đầu.
        expect(resumed.dispatch({ type: IntentType.PlaceDogAttempt, cell: SOLUTION[1] })).toBe(true);
    });

    it('ô pre-placed vẫn KHÓA sau resume — tập ô khóa dựng lại từ PuzzleData', () => {
        const session = new PuzzleSession({
            puzzle: PUZZLE_4X4_WITH_PREPLACED,
            context: 'campaign',
            puzzleDate: null,
            placeDogCharges: 1,
            hintCharges: 3,
        });
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: 2 });

        persist(session, storage);

        const snapshot = deserializeSaveData(storage.read()!).playerData.boardInProgress;
        const resumed = new PuzzleSession({
            puzzle: PUZZLE_4X4_WITH_PREPLACED,
            context: 'campaign',
            puzzleDate: null,
            placeDogCharges: 1,
            hintCharges: 3,
            snapshot,
        });

        expect(resumed.isLocked(13)).toBe(true);
        expect(resumed.dispatch({ type: IntentType.ToggleMark, cell: 13 })).toBe(false);
        expect(resumed.cellStates[13]).toBe(CellState.Dog);
    });

    it('ghi liên tiếp nhiều lần: lần đọc cuối phản ánh trạng thái MỚI NHẤT', () => {
        const session = new PuzzleSession({
            puzzle: PUZZLE_4X4,
            context: 'campaign',
            puzzleDate: null,
            placeDogCharges: 3,
            hintCharges: 3,
        });

        // Mô phỏng một cú DragMark qua 3 ô → 3 event → 3 lần persist liên tiếp.
        for (const cell of [5, 6, 7]) {
            session.dispatch({ type: IntentType.ToggleMark, cell });
            persist(session, storage, storage.read() ?? undefined);
        }

        const snapshot = deserializeSaveData(storage.read()!).playerData.boardInProgress!;
        expect(snapshot.cellStates[5]).toBe(CellState.Mark);
        expect(snapshot.cellStates[6]).toBe(CellState.Mark);
        expect(snapshot.cellStates[7]).toBe(CellState.Mark);
    });

    it('ván KẾT THÚC → boardInProgress phải là null trong save', () => {
        const session = new PuzzleSession({
            puzzle: PUZZLE_4X4,
            context: 'campaign',
            puzzleDate: null,
            placeDogCharges: 3,
            hintCharges: 3,
        });

        for (const cell of SOLUTION) {
            session.dispatch({ type: IntentType.PlaceDogAttempt, cell });
            persist(session, storage, storage.read() ?? undefined);
        }

        // GameManager gỡ snapshot khi nghe PuzzleSolvedEvent, rồi persist tường minh.
        persist(null, storage, storage.read()!);

        const loaded = deserializeSaveData(storage.read()!);
        expect(loaded.playerData.boardInProgress).toBeNull();
    });

    it('snapshot daily mang ngày → resume ngày khác phải bị TỪ CHỐI', () => {
        const session = new PuzzleSession({
            puzzle: PUZZLE_4X4,
            context: 'daily',
            puzzleDate: '2026-07-14',
            placeDogCharges: 1,
            hintCharges: 3,
        });
        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });

        persist(session, storage);
        const snapshot = deserializeSaveData(storage.read()!).playerData.boardInProgress!;

        // Đúng logic GameManager.takeResumableSnapshot(): daily phải khớp NGÀY HÔM NAY.
        const isUsableToday = (today: string): boolean =>
            snapshot.context === 'daily' && snapshot.puzzleDate === today;

        expect(isUsableToday('2026-07-14')).toBe(true);
        expect(isUsableToday('2026-07-15')).toBe(false); // sang ngày mới → bỏ snapshot
    });

    it('snapshot của puzzle KHÁC không được dùng nhầm', () => {
        const session = new PuzzleSession({
            puzzle: PUZZLE_4X4,
            context: 'campaign',
            puzzleDate: null,
            placeDogCharges: 1,
            hintCharges: 3,
        });
        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });
        persist(session, storage);

        const snapshot = deserializeSaveData(storage.read()!).playerData.boardInProgress!;

        // Đúng logic GameManager: id phải khớp.
        const matchesLevel = (id: number): boolean =>
            snapshot.context === 'campaign' && snapshot.puzzleId === id;

        expect(matchesLevel(PUZZLE_4X4.id)).toBe(true);
        expect(matchesLevel(PUZZLE_4X4.id + 1)).toBe(false);
    });
});
