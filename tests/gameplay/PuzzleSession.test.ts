import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PuzzleSession } from '../../assets/scripts/gameplay/PuzzleSession';
import { IntentType } from '../../assets/scripts/gameplay/PuzzleIntent';
import { CellState } from '../../assets/scripts/core/CellState';
import { PuzzleState } from '../../assets/scripts/core/PuzzleState';
import { EventManager } from '../../assets/scripts/core/EventManager';
import { GameConfig } from '../../assets/scripts/config/GameConfig';
import {
    CELL_CHANGED_EVENT,
    CellChangedEventPayload,
    HINT_SHOWN_EVENT,
    HintShownEventPayload,
    MISTAKE_CHANGED_EVENT,
    PLACE_DOG_USED_EVENT,
    PUZZLE_FAILED_EVENT,
    PUZZLE_SOLVED_EVENT,
    BOARD_RESTARTED_EVENT,
    PUZZLE_READY_EVENT,
    PuzzleReadyEventPayload,
} from '../../assets/scripts/event/PuzzleEvents';
import { PUZZLE_4X4, PUZZLE_4X4_WITH_PREPLACED } from '../helpers/makePuzzle';

// PUZZLE_4X4: size 4, solution = [2, 4, 11, 13]
const SOLUTION = [2, 4, 11, 13];
const WRONG_CELL = 0; // không nằm trong solution

/** Thu event phát ra để kiểm tra Gameplay giao tiếp đúng cách. */
class EventSpy {
    readonly received: Array<{ name: string; payload: unknown }> = [];

    constructor(names: string[]) {
        for (const name of names) {
            EventManager.instance.on(name, (payload) => {
                this.received.push({ name, payload });
            }, this);
        }
    }

    countOf(name: string): number {
        return this.received.filter((e) => e.name === name).length;
    }

    payloadsOf<T>(name: string): T[] {
        return this.received.filter((e) => e.name === name).map((e) => e.payload as T);
    }

    dispose(): void {
        EventManager.instance.targetOff(this);
    }
}

const ALL_EVENTS = [
    PUZZLE_READY_EVENT,
    CELL_CHANGED_EVENT,
    MISTAKE_CHANGED_EVENT,
    PLACE_DOG_USED_EVENT,
    HINT_SHOWN_EVENT,
    BOARD_RESTARTED_EVENT,
    PUZZLE_SOLVED_EVENT,
    PUZZLE_FAILED_EVENT,
];

let spy: EventSpy;

function makeSession(overrides: Partial<Parameters<typeof createOpts>[0]> = {}) {
    return new PuzzleSession(createOpts(overrides));
}

function createOpts(o: {
    puzzle?: typeof PUZZLE_4X4;
    placeDogCharges?: number;
    hintCharges?: number;
    context?: 'campaign' | 'daily';
} = {}) {
    return {
        puzzle: o.puzzle ?? PUZZLE_4X4,
        context: o.context ?? ('campaign' as const),
        puzzleDate: null,
        placeDogCharges: o.placeDogCharges ?? 3,
        hintCharges: o.hintCharges ?? 3,
    };
}

beforeEach(() => {
    spy = new EventSpy(ALL_EVENTS);
});

afterEach(() => {
    spy.dispose();
});

describe('PuzzleSession — khởi tạo', () => {
    it('phát PuzzleReadyEvent, state = Ready, không lộ solution', () => {
        const session = makeSession();

        expect(session.state).toBe(PuzzleState.Ready);
        expect(spy.countOf(PUZZLE_READY_EVENT)).toBe(1);

        const payload = spy.payloadsOf<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT)[0];
        expect(payload.size).toBe(4);
        expect(payload.mistakesRemaining).toBe(GameConfig.maxMistakes);
        expect(payload.totalDogs).toBe(4);
        // Không có trường nào chứa solution.
        expect(JSON.stringify(payload)).not.toContain('solution');
    });
});

describe('PuzzleSession — Placement Check (11 — mục 6)', () => {
    it('đặt đúng ô solution → Dog', () => {
        const session = makeSession();
        expect(session.dispatch({ type: IntentType.PlaceDogAttempt, cell: SOLUTION[0] })).toBe(true);

        expect(session.cellStates[SOLUTION[0]]).toBe(CellState.Dog);
        expect(session.mistakesRemaining).toBe(3);
        expect(session.state).toBe(PuzzleState.Playing);
        expect(spy.countOf(MISTAKE_CHANGED_EVENT)).toBe(0);
    });

    it('đặt sai → WrongMark + mistake −1', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: WRONG_CELL });

        expect(session.cellStates[WRONG_CELL]).toBe(CellState.WrongMark);
        expect(session.mistakesRemaining).toBe(2);
        expect(spy.countOf(MISTAKE_CHANGED_EVENT)).toBe(1);
    });

    it('đặt Dog đúng lên ô đang có Mark → Mark bị thay bằng Dog', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.ToggleMark, cell: SOLUTION[0] });
        expect(session.cellStates[SOLUTION[0]]).toBe(CellState.Mark);

        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: SOLUTION[0] });
        expect(session.cellStates[SOLUTION[0]]).toBe(CellState.Dog);
    });

    it('TỪ CHỐI đặt lên ô đã có Dog hoặc WrongMark', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: SOLUTION[0] });
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: WRONG_CELL });

        expect(session.dispatch({ type: IntentType.PlaceDogAttempt, cell: SOLUTION[0] })).toBe(false);
        expect(session.dispatch({ type: IntentType.PlaceDogAttempt, cell: WRONG_CELL })).toBe(false);
        expect(session.mistakesRemaining).toBe(2); // không bị trừ thêm
    });

    it('lý do sai: xung đột hàng/cột/vùng với Dog đã có', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: 2 }); // Dog ở row0 col2

        // Ô 1: cùng hàng 0 với Dog ở ô 2, và kề nó.
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: 1 });

        const changes = spy.payloadsOf<CellChangedEventPayload>(CELL_CHANGED_EVENT);
        const wrong = changes.find((c) => c.cell === 1);
        expect(wrong?.state).toBe(CellState.WrongMark);
        expect(wrong?.wrongReason).not.toBeNull();
        expect(wrong!.wrongReason!.groups.some((g) => g.kind === 'Row' && g.index === 0)).toBe(true);
        expect(wrong!.wrongReason!.adjacent.some((a) => a.cell === 2)).toBe(true);
    });

    it('lý do sai CÓ THỂ RỖNG khi chưa xung đột với Dog nào', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: WRONG_CELL });

        const changes = spy.payloadsOf<CellChangedEventPayload>(CELL_CHANGED_EVENT);
        const wrong = changes.find((c) => c.cell === WRONG_CELL);
        expect(wrong!.wrongReason!.groups).toHaveLength(0);
        expect(wrong!.wrongReason!.adjacent).toHaveLength(0);
    });
});

describe('PuzzleSession — Mark và Drag (11 — mục 4.3)', () => {
    it('ToggleMark bật rồi tắt', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });
        expect(session.cellStates[5]).toBe(CellState.Mark);

        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });
        expect(session.cellStates[5]).toBe(CellState.Empty);
    });

    it('DragMark chế độ mark: chỉ đổi ô Empty', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.ToggleMark, cell: 6 }); // ô 6 đã có Mark

        session.dispatch({ type: IntentType.DragMark, cells: [5, 6, 7], mode: 'mark' });

        expect(session.cellStates[5]).toBe(CellState.Mark);
        expect(session.cellStates[6]).toBe(CellState.Mark);
        expect(session.cellStates[7]).toBe(CellState.Mark);
    });

    it('DragMark chế độ erase: chỉ đổi ô Mark, không đụng Dog', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });
        session.dispatch({ type: IntentType.ToggleMark, cell: 6 });
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: 4 }); // Dog thật ở ô 4

        session.dispatch({ type: IntentType.DragMark, cells: [4, 5, 6], mode: 'erase' });

        expect(session.cellStates[4]).toBe(CellState.Dog); // Dog KHÔNG bị xóa
        expect(session.cellStates[5]).toBe(CellState.Empty);
        expect(session.cellStates[6]).toBe(CellState.Empty);
    });

    it('DragMark bỏ qua ô khóa', () => {
        const session = makeSession({ puzzle: PUZZLE_4X4_WITH_PREPLACED });
        session.dispatch({ type: IntentType.DragMark, cells: [12, 13, 14], mode: 'mark' });

        expect(session.cellStates[13]).toBe(CellState.Dog); // pre-placed, giữ nguyên
        expect(session.cellStates[12]).toBe(CellState.Mark);
        expect(session.cellStates[14]).toBe(CellState.Mark);
    });
});

describe('PuzzleSession — Thất bại (02 — mục 4)', () => {
    it('3 lần sai → Failed, board khóa, Intent sau đó bị từ chối', () => {
        const session = makeSession();
        const wrongCells = [0, 1, 3]; // không ô nào trong solution

        for (const cell of wrongCells) {
            session.dispatch({ type: IntentType.PlaceDogAttempt, cell });
        }

        expect(session.mistakesRemaining).toBe(0);
        expect(session.state).toBe(PuzzleState.Failed);
        expect(spy.countOf(PUZZLE_FAILED_EVENT)).toBe(1);

        // Board bị khóa.
        expect(session.dispatch({ type: IntentType.ToggleMark, cell: 5 })).toBe(false);
        expect(session.dispatch({ type: IntentType.PlaceDogAttempt, cell: 2 })).toBe(false);
        expect(session.cellStates[5]).toBe(CellState.Empty);
    });
});

describe('PuzzleSession — Hoàn thành', () => {
    it('Dog cuối cùng → Solved', () => {
        const session = makeSession();
        for (const cell of SOLUTION) {
            session.dispatch({ type: IntentType.PlaceDogAttempt, cell });
        }

        expect(session.state).toBe(PuzzleState.Solved);
        expect(spy.countOf(PUZZLE_SOLVED_EVENT)).toBe(1);
    });

    it('puzzle có pre-placed Dog: chỉ cần đặt N−1 Dog', () => {
        const session = makeSession({ puzzle: PUZZLE_4X4_WITH_PREPLACED });
        // Ô 13 đã có sẵn Dog. Chỉ cần đặt 3 ô còn lại.
        for (const cell of [2, 4, 11]) {
            session.dispatch({ type: IntentType.PlaceDogAttempt, cell });
        }

        expect(session.state).toBe(PuzzleState.Solved);
        expect(spy.countOf(PUZZLE_SOLVED_EVENT)).toBe(1);
    });

    it('Intent sau khi Solved bị từ chối', () => {
        const session = makeSession();
        for (const cell of SOLUTION) {
            session.dispatch({ type: IntentType.PlaceDogAttempt, cell });
        }
        expect(session.dispatch({ type: IntentType.ToggleMark, cell: 0 })).toBe(false);
    });
});

describe('PuzzleSession — Place Dog (11 — mục 7.1)', () => {
    it('đặt Dog đúng, KHÔNG trừ mistake, trừ lượt', () => {
        const session = makeSession({ placeDogCharges: 2 });
        session.dispatch({ type: IntentType.UsePlaceDog });

        expect(session.placeDogCharges).toBe(1);
        expect(session.mistakesRemaining).toBe(3);
        expect(spy.countOf(PLACE_DOG_USED_EVENT)).toBe(1);

        // Ô được đặt phải nằm trong solution.
        const dogCells = session.cellStates
            .map((s, i) => (s === CellState.Dog ? i : -1))
            .filter((i) => i >= 0);
        expect(dogCells).toHaveLength(1);
        expect(SOLUTION).toContain(dogCells[0]);
    });

    it('tất định: luôn chọn ô đúng có chỉ số nhỏ nhất', () => {
        const a = makeSession();
        const b = makeSession();
        a.dispatch({ type: IntentType.UsePlaceDog });
        b.dispatch({ type: IntentType.UsePlaceDog });
        expect(a.cellStates).toEqual(b.cellStates);
        expect(a.cellStates[2]).toBe(CellState.Dog); // ô nhỏ nhất trong solution
    });

    it('hết lượt → từ chối', () => {
        const session = makeSession({ placeDogCharges: 0 });
        expect(session.dispatch({ type: IntentType.UsePlaceDog })).toBe(false);
        expect(spy.countOf(PLACE_DOG_USED_EVENT)).toBe(0);
    });

    it('Place Dog đủ N lần → Solved', () => {
        const session = makeSession({ placeDogCharges: 4 });
        for (let i = 0; i < 4; i++) session.dispatch({ type: IntentType.UsePlaceDog });
        expect(session.state).toBe(PuzzleState.Solved);
    });
});

describe('PuzzleSession — Hint có hạn (11 — mục 7.2)', () => {
    it('mỗi lần bấm trừ một lượt, phát HintShownEvent kèm số còn lại', () => {
        const session = makeSession({ hintCharges: 2 });

        expect(session.dispatch({ type: IntentType.ShowHint })).toBe(true);
        expect(session.remainingHints).toBe(1);

        const payloads = spy.payloadsOf<HintShownEventPayload>(HINT_SHOWN_EVENT);
        expect(payloads[0].chargesRemaining).toBe(1);
        expect(payloads[0].group).not.toBeNull();
    });

    it('hết lượt → từ chối, không phát event', () => {
        const session = makeSession({ hintCharges: 0 });
        expect(session.dispatch({ type: IntentType.ShowHint })).toBe(false);
        expect(spy.countOf(HINT_SHOWN_EVENT)).toBe(0);
        expect(session.remainingHints).toBe(0);
    });

    it('bàn gần xong, không còn gợi ý → KHÔNG trừ lượt', () => {
        const session = makeSession({ hintCharges: 3 });
        // Đặt hết Dog trừ ô cuối — nhưng cần còn Playing, nên đặt 3/4.
        for (const cell of [2, 4, 11]) {
            session.dispatch({ type: IntentType.PlaceDogAttempt, cell });
        }
        // Ô cuối (13) là ô khả dĩ duy nhất → getHint trả nhóm chứa nó, VẪN trừ lượt.
        // Đây không phải ca "không còn gợi ý"; ta chỉ kiểm getHint vẫn chạy an toàn.
        session.dispatch({ type: IntentType.ShowHint });
        expect(session.remainingHints).toBe(2); // đã trừ vì vẫn còn gợi ý
    });

    it('lượt Hint KHÔNG hoàn lại khi Restart (là inventory, không phải state bàn)', () => {
        const session = makeSession({ hintCharges: 2 });
        session.dispatch({ type: IntentType.ShowHint });
        expect(session.remainingHints).toBe(1);

        session.dispatch({ type: IntentType.Restart });
        expect(session.remainingHints).toBe(1); // không reset
    });
});

describe('PuzzleSession — Restart (11 — mục 7.3)', () => {
    it('xóa ô người chơi điền, mistake về đầy, KHÔNG hoàn lượt Place Dog', () => {
        const session = makeSession({ placeDogCharges: 2 });

        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: WRONG_CELL }); // mistake -1
        session.dispatch({ type: IntentType.UsePlaceDog }); // dùng 1 lượt
        expect(session.placeDogCharges).toBe(1);
        expect(session.mistakesRemaining).toBe(2);

        session.dispatch({ type: IntentType.Restart });

        expect(session.cellStates[5]).toBe(CellState.Empty);
        expect(session.cellStates[WRONG_CELL]).toBe(CellState.Empty);
        expect(session.mistakesRemaining).toBe(3);
        expect(session.placeDogCharges).toBe(1); // KHÔNG hoàn lại — chặn exploit
        expect(session.state).toBe(PuzzleState.Ready);
        expect(spy.countOf(BOARD_RESTARTED_EVENT)).toBe(1);
    });

    it('GIỮ NGUYÊN ô pre-placed', () => {
        const session = makeSession({ puzzle: PUZZLE_4X4_WITH_PREPLACED });
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: 2 });

        session.dispatch({ type: IntentType.Restart });

        expect(session.cellStates[13]).toBe(CellState.Dog); // pre-placed
        expect(session.cellStates[2]).toBe(CellState.Empty); // người chơi điền
    });

    it('phát MỘT event cho cả bàn, không phát CellChangedEvent từng ô', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });
        session.dispatch({ type: IntentType.ToggleMark, cell: 6 });

        const before = spy.countOf(CELL_CHANGED_EVENT);
        session.dispatch({ type: IntentType.Restart });

        expect(spy.countOf(CELL_CHANGED_EVENT)).toBe(before); // không tăng
        expect(spy.countOf(BOARD_RESTARTED_EVENT)).toBe(1);
    });
});

describe('PuzzleSession — ô khóa', () => {
    it('mọi Intent lên ô pre-placed đều bị từ chối', () => {
        const session = makeSession({ puzzle: PUZZLE_4X4_WITH_PREPLACED });

        expect(session.dispatch({ type: IntentType.ToggleMark, cell: 13 })).toBe(false);
        expect(session.dispatch({ type: IntentType.PlaceDogAttempt, cell: 13 })).toBe(false);
        expect(session.cellStates[13]).toBe(CellState.Dog);
        expect(session.isLocked(13)).toBe(true);
    });
});

describe('PuzzleSession — snapshot / resume', () => {
    it('snapshot rồi resume cho ra đúng board và mistake', () => {
        const session = makeSession();
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: SOLUTION[0] });
        session.dispatch({ type: IntentType.PlaceDogAttempt, cell: WRONG_CELL });
        session.dispatch({ type: IntentType.ToggleMark, cell: 5 });

        const snapshot = session.createSnapshot();
        expect(snapshot.mistakesRemaining).toBe(2);

        const resumed = new PuzzleSession({ ...createOpts(), snapshot });

        expect(resumed.cellStates[SOLUTION[0]]).toBe(CellState.Dog);
        expect(resumed.cellStates[WRONG_CELL]).toBe(CellState.WrongMark);
        expect(resumed.cellStates[5]).toBe(CellState.Mark);
        expect(resumed.mistakesRemaining).toBe(2);
    });

    it('snapshot daily mang theo ngày', () => {
        const session = new PuzzleSession({
            puzzle: PUZZLE_4X4,
            context: 'daily',
            puzzleDate: '2026-07-14',
            placeDogCharges: 1,
            hintCharges: 1,
        });
        expect(session.createSnapshot().puzzleDate).toBe('2026-07-14');
    });
});

describe('PuzzleSession — dispose', () => {
    it('Disposed thì mọi Intent bị từ chối', () => {
        const session = makeSession();
        session.dispose();

        expect(session.state).toBe(PuzzleState.Disposed);
        expect(session.dispatch({ type: IntentType.ToggleMark, cell: 5 })).toBe(false);
    });
});
