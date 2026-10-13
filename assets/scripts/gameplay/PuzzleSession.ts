import { CellState } from '../core/CellState';
import { PuzzleState } from '../core/PuzzleState';
import { WrongReason } from '../core/BoardGroup';
import { Hint, HintAction } from '../core/Hint';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../config/GameConfig';
import { isHardLevel } from '../config/LevelListConfig';
import { PuzzleData } from '../model/PuzzleData';
import { BoardSaveData, PuzzleContext } from '../model/BoardSaveData';
import {
    AUTO_MARK_APPLIED_EVENT,
    AutoMarkAppliedEventPayload,
    BOARD_RESTARTED_EVENT,
    BoardRestartedEventPayload,
    CELL_CHANGED_EVENT,
    CellChangedEventPayload,
    HINT_SHOWN_EVENT,
    HintShownEventPayload,
    MISTAKE_CHANGED_EVENT,
    MistakeChangedEventPayload,
    PLACE_DOG_USED_EVENT,
    PlaceDogUsedEventPayload,
    SCORE_CHANGED_EVENT,
    ScoreChangedEventPayload,
    PUZZLE_FAILED_EVENT,
    PUZZLE_READY_EVENT,
    PUZZLE_SOLVED_EVENT,
    PuzzleFailedEventPayload,
    PuzzleReadyEventPayload,
    PuzzleSolvedEventPayload,
} from '../event/PuzzleEvents';
import { BoardSystem } from './board/BoardSystem';
import { PlacementCheck } from './validation/PlacementCheck';
import { MistakeCounter } from './validation/MistakeCounter';
import { PuzzleStateMachine } from './state/PuzzleStateMachine';
import { HintSystem } from './assist/HintSystem';
import { PlaceDogSystem } from './assist/PlaceDogSystem';
import { ScoreSystem } from './scoring/ScoreSystem';
import { PuzzleTimer } from './timer/PuzzleTimer';
import { IntentType, PuzzleIntent } from './PuzzleIntent';

export interface PuzzleSessionOptions {
    readonly puzzle: PuzzleData;
    readonly context: PuzzleContext;
    readonly puzzleDate: string | null;
    readonly placeDogCharges: number;
    readonly hintCharges: number;
    readonly snapshot?: BoardSaveData | null;


    readonly displayId?: number;
}


export class PuzzleSession {
    private readonly board: BoardSystem;
    private readonly placement: PlacementCheck;
    private readonly mistakes: MistakeCounter;
    private readonly hints: HintSystem;
    private readonly placeDog: PlaceDogSystem;
    private readonly score: ScoreSystem;
    private readonly timer = new PuzzleTimer();
    private readonly machine = new PuzzleStateMachine();

    private readonly puzzle: PuzzleData;
    private readonly context: PuzzleContext;
    private readonly puzzleDate: string | null;
    private readonly resumed: boolean;
    private readonly displayId: number;


    private hintCharges: number;

    private pendingHint: Hint | null = null;
    /** true trong lúc handleApplyHint() đang chạy — đánh dấu các emitCellChanged() bên trong là "viaHint". */
    private applyingHint = false;

    constructor(options: PuzzleSessionOptions) {
        this.puzzle = options.puzzle;
        this.context = options.context;
        this.puzzleDate = options.puzzleDate;
        this.displayId = options.displayId ?? options.puzzle.id;
        this.hintCharges = Math.max(0, options.hintCharges);

        this.board = new BoardSystem(options.puzzle);
        this.placement = new PlacementCheck(options.puzzle.solution);
        this.mistakes = new MistakeCounter(GameConfig.maxMistakes);
        this.hints = new HintSystem(options.puzzle.solution);
        this.placeDog = new PlaceDogSystem(options.puzzle.solution, options.placeDogCharges);
        this.score = new ScoreSystem();

        let timerBase = 0;
        this.resumed = !!options.snapshot && this.board.restoreFrom(options.snapshot);
        if (this.resumed) {
            this.mistakes.restore(options.snapshot!.mistakesRemaining);

            this.score.recomputeFrom(this.board.getAllStates());
            timerBase = options.snapshot!.elapsedSeconds;
        }

        this.timer.start(timerBase);

        this.machine.transition(PuzzleState.Ready);
        this.emitReady();
    }

  

    get state(): PuzzleState {
        return this.machine.state;
    }

    get size(): number {
        return this.board.size;
    }

    get regions(): readonly number[] {
        return this.board.regions;
    }

    get cellStates(): readonly CellState[] {
        return this.board.getAllStates();
    }

    get mistakesRemaining(): number {
        return this.mistakes.remaining;
    }

    get placeDogCharges(): number {
        return this.placeDog.charges;
    }

   
    grantPlaceDogCharges(amount: number): number {
        const remaining = this.placeDog.grant(amount);

        this.emit<PlaceDogUsedEventPayload>(PLACE_DOG_USED_EVENT, {
            cell: -1,
            chargesRemaining: remaining,
        });
        return remaining;
    }

    get remainingHints(): number {
        return this.hintCharges;
    }

    /** Cộng lượt Hint sau khi xem quảng cáo/mua — cùng mẫu grantPlaceDogCharges(), tái dùng
     * HINT_SHOWN_EVENT với hint=null làm "sentinel" báo chỉ đổi SỐ LƯỢT, không phải gợi ý mới
     * (HintController.onHintShown() đã tự bỏ qua khi payload.hint null, xem code ở đó). */
    grantHintCharges(amount: number): number {
        this.hintCharges = Math.max(0, this.hintCharges + amount);

        this.emit<HintShownEventPayload>(HINT_SHOWN_EVENT, {
            hint: null,
            chargesRemaining: this.hintCharges,
        });
        return this.hintCharges;
    }

    get elapsedSeconds(): number {
        return this.timer.elapsedSeconds;
    }

    get totalScore(): number {
        return this.score.score;
    }

    get isTimerRunning(): boolean {
        return this.timer.isRunning;
    }

    isLocked(cell: number): boolean {
        return this.board.isLocked(cell);
    }

   
    forgiveWrongMark(cell: number): number {
        if (this.board.getState(cell) !== CellState.WrongMark) return this.mistakes.remaining;

        this.board.setState(cell, CellState.Empty);
        this.emitCellChanged(cell, CellState.Empty, null);

        this.mistakes.restore(this.mistakes.remaining + 1);
        const remaining = this.mistakes.remaining;
        this.emit<MistakeChangedEventPayload>(MISTAKE_CHANGED_EVENT, {
            remaining,
            max: this.mistakes.max,
        });
        return remaining;
    }

    createSnapshot(): BoardSaveData {
        return this.board.createSnapshot(
            this.context,
            this.puzzle.id,
            this.puzzleDate,
            this.mistakes.remaining,
            this.timer.elapsedSeconds,
        );
    }


    dispatch(intent: PuzzleIntent): boolean {
        if (!this.machine.acceptsIntent) {
            console.warn(
                `[PuzzleSession] Intent ${intent.type} bị từ chối ở state ${this.machine.state}. ` +
                    'UI lẽ ra phải khóa board.',
            );
            return false;
        }

        switch (intent.type) {
            case IntentType.ToggleMark:
                return this.handleToggleMark(intent.cell);
            case IntentType.DragMark:
                return this.handleDragMark(intent.cells, intent.mode);
            case IntentType.PlaceDogAttempt:
                return this.handlePlaceDogAttempt(intent.cell);
            case IntentType.UsePlaceDog:
                return this.handleUsePlaceDog();
            case IntentType.ShowHint:
                return this.handleShowHint();
            case IntentType.ApplyHint:
                return this.handleApplyHint();
            case IntentType.Restart:
                return this.handleRestart();
        }
    }

    dispose(): void {
        this.machine.transition(PuzzleState.Disposed);
        EventManager.instance.targetOff(this);
    }


    emitReadyAgain(): void {
        this.emitReady(true);
    }


    private handleToggleMark(cell: number): boolean {
        if (!this.canEdit(cell)) return false;

        const current = this.board.getState(cell);
        if (current !== CellState.Empty && current !== CellState.Mark) return false;

        const next = current === CellState.Mark ? CellState.Empty : CellState.Mark;
        if (!this.board.setState(cell, next)) return false;

        this.machine.markPlaying();
        this.emitCellChanged(cell, next, null);
        return true;
    }

    private handleDragMark(cells: readonly number[], mode: 'mark' | 'erase'): boolean {
        const from = mode === 'mark' ? CellState.Empty : CellState.Mark;
        const to = mode === 'mark' ? CellState.Mark : CellState.Empty;

        let changed = false;
        for (const cell of cells) {
            if (!this.canEdit(cell)) continue;
            if (this.board.getState(cell) !== from) continue;
            if (!this.board.setState(cell, to)) continue;

            changed = true;
            this.emitCellChanged(cell, to, null);
        }

        if (changed) this.machine.markPlaying();
        return changed;
    }

    private handlePlaceDogAttempt(cell: number): boolean {
        if (!this.canEdit(cell)) return false;

        const current = this.board.getState(cell);
        if (current === CellState.Dog || current === CellState.WrongMark) return false;

        this.machine.markPlaying();

        if (this.placement.isCorrectCell(cell)) {
            this.board.setState(cell, CellState.Dog);
            this.emitCellChanged(cell, CellState.Dog, null);
            const gained = this.score.addForDog(cell, this.timer.elapsedSeconds);
            this.emitScore(this.score.score, gained, cell);
            this.checkCompletion();
            return true;
        }


        const reason = this.placement.explainWrong(this.board, cell);

        this.board.setState(cell, CellState.WrongMark);
        this.emitCellChanged(cell, CellState.WrongMark, reason);
        this.score.resetStreak();

        const remaining = this.mistakes.consume();
        this.emit<MistakeChangedEventPayload>(MISTAKE_CHANGED_EVENT, {
            remaining,
            max: this.mistakes.max,
        });

        this.checkFailure();
        return true;
    }

    private handleUsePlaceDog(): boolean {
        if (!this.placeDog.hasCharge) return false;

        const cell = this.placeDog.findNextCell(this.board);
        if (cell === null) return false;

        this.machine.markPlaying();

        this.board.setState(cell, CellState.Dog);
        const remaining = this.placeDog.consume();

        this.emitCellChanged(cell, CellState.Dog, null);
        const gained = this.score.addForAssistedDog(cell);
        this.emitScore(this.score.score, gained, cell, true);
        this.emit<PlaceDogUsedEventPayload>(PLACE_DOG_USED_EVENT, {
            cell,
            chargesRemaining: remaining,
        });

        this.checkCompletion();
        return true;
    }

    private handleShowHint(): boolean {
        if (this.hintCharges <= 0) return false;

        this.machine.markPlaying();
        const hint = this.hints.getHint(this.board);
        this.pendingHint = hint;

        // BUG CŨ: charges được kiểm tra (<=0 chặn) nhưng KHÔNG BAO GIỜ bị trừ ở đây — hint dùng
        // thoải mái vô hạn dù hintCharges hiển thị có giảm hay không. Trừ đúng 1 lượt mỗi lần TÌM
        // ĐƯỢC gợi ý hợp lệ (hint !== null) — cùng quy tắc "chỉ trừ khi thật sự dùng được" như
        // handleUsePlaceDog() (chỉ placeDog.consume() khi findNextCell() có kết quả).
        if (hint) this.hintCharges = Math.max(0, this.hintCharges - 1);

        this.emit<HintShownEventPayload>(HINT_SHOWN_EVENT, {
            hint,
            chargesRemaining: this.hintCharges,
        });
        return hint !== null;
    }

    private handleApplyHint(): boolean {
        const hint = this.pendingHint;
        if (!hint) return false;

        this.pendingHint = null;
        this.applyingHint = true;
        try {
            switch (hint.action) {
                case HintAction.PlaceDog:
                    return this.handlePlaceDogAttempt(hint.targetCells[0]!);
                case HintAction.MarkCells:
                    return this.handleDragMark(hint.targetCells, 'mark');
                case HintAction.ClearMark:
                    return this.handleToggleMark(hint.targetCells[0]!);
            }
        } finally {
            this.applyingHint = false;
        }
    }

    private handleRestart(): boolean {
        this.pendingHint = null;
        this.board.resetToInitial();
        this.mistakes.reset();
        this.score.reset();

        this.machine.transition(PuzzleState.Ready);

        this.emit<BoardRestartedEventPayload>(BOARD_RESTARTED_EVENT, {
            puzzleId: this.displayId,
            cellStates: this.board.getAllStates(),
            mistakesRemaining: this.mistakes.remaining,
        });
      
        this.emitScore(this.score.recomputeFrom(this.board.getAllStates()), 0, -1);
        return true;
    }


    private canEdit(cell: number): boolean {
        return this.board.isInBounds(cell) && !this.board.isLocked(cell);
    }

    private checkCompletion(): void {

        if (this.machine.state === PuzzleState.Solved) return;


        if (this.board.countDogs() < this.puzzle.solution.length) return;

        this.autoMarkRemainingCells();

        this.timer.stop();
        this.machine.transition(PuzzleState.Solved);
        this.emit<PuzzleSolvedEventPayload>(PUZZLE_SOLVED_EVENT, {
            context: this.context,
            puzzleId: this.displayId,
            mistakesRemaining: this.mistakes.remaining,
        });
    }

    /** Ô nào còn Empty lúc thắng màn (người chơi thắng mà KHÔNG cần tự đánh dấu X) được TỰ ĐỘNG
     * đánh dấu giúp, mỗi ô thưởng GameConfig.scoreAutoMarkBonus điểm (ScoreSystem.addForAutoMark).
     * Dữ liệu (board state + tổng điểm) ĐÚNG NGAY LẬP TỨC (chạy TRƯỚC PUZZLE_SOLVED_EVENT — bất
     * cứ ai đọc this.cellStates/this.totalScore ngay sau khi thắng đều thấy đúng). CỐ TÌNH KHÔNG
     * bắn CELL_CHANGED_EVENT/SCORE_CHANGED_EVENT cho các ô này ở đây — thay vào đó gộp thành 1
     * AUTO_MARK_APPLIED_EVENT duy nhất, để BoardView/GameplayScreen tự chọn THỜI ĐIỂM/CÁCH hiện
     * (dừng nhịp → hiện X → đốm sáng bay tới score label → điểm tăng) thay vì hiện ngay lập tức
     * cùng lúc với hành động đặt con chó cuối cùng của người chơi. */
    private autoMarkRemainingCells(): void {
        const states = this.board.getAllStates();
        const cells: number[] = [];
        let totalGained = 0;
        for (let cell = 0; cell < states.length; cell++) {
            if (states[cell] !== CellState.Empty) continue;
            if (!this.board.setState(cell, CellState.Mark)) continue;

            cells.push(cell);
            totalGained += this.score.addForAutoMark(cell);
        }
        if (cells.length === 0) return;

        this.emit<AutoMarkAppliedEventPayload>(AUTO_MARK_APPLIED_EVENT, {
            cells,
            scoreGained: totalGained,
            totalScore: this.score.score,
        });
    }

    private checkFailure(): void {

        if (this.context === 'tutorial') return;
        if (!this.mistakes.isExhausted) return;

        this.timer.stop();
        this.machine.transition(PuzzleState.Failed);
        this.emit<PuzzleFailedEventPayload>(PUZZLE_FAILED_EVENT, {
            context: this.context,
            puzzleId: this.displayId,
        });
    }

    private emitReady(instant = false): void {
        this.emit<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT, {
            context: this.context,
            puzzleId: this.displayId,
            isHardLevel: this.context === 'campaign' && isHardLevel(this.displayId),
            size: this.board.size,
            regions: this.board.regions,
            cellStates: this.board.getAllStates(),
            lockedCells: this.puzzle.prePlacedDogs.concat(this.puzzle.prePlacedMarks),
            mistakesRemaining: this.mistakes.remaining,
            maxMistakes: this.mistakes.max,
            placeDogCharges: this.placeDog.charges,
            hintCharges: this.hintCharges,
            totalDogs: this.puzzle.solution.length,
            score: this.score.score,
            isResume: this.resumed,
            tutorialGuidedCells: this.context === 'tutorial' ? this.puzzle.solution : undefined,
            instant,
        });
    }

    private emitCellChanged(cell: number, state: CellState, wrongReason: WrongReason | null): void {
        this.emit<CellChangedEventPayload>(CELL_CHANGED_EVENT, {
            cell,
            state,
            wrongReason,
            viaHint: this.applyingHint,
            isMisplacedMark: state === CellState.Mark && this.puzzle.solution.indexOf(cell) >= 0,
        });
    }

    private emitScore(score: number, gained: number, cell: number, viaPlaceDog = false): void {
        this.emit<ScoreChangedEventPayload>(SCORE_CHANGED_EVENT, {
            score,
            gained,
            cell,
            streak: this.score.comboStreak,
            viaPlaceDog,
        });
    }

    private emit<T>(eventName: string, payload: T): void {
        EventManager.instance.emit<T>(eventName, payload);
    }
}
