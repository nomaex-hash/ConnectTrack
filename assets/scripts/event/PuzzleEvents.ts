import { CellState } from '../core/CellState';
import { WrongReason } from '../core/BoardGroup';
import { Hint } from '../core/Hint';
import { PuzzleContext } from '../model/BoardSaveData';



export const PUZZLE_READY_EVENT = 'PuzzleReadyEvent';
export const CELL_CHANGED_EVENT = 'CellChangedEvent';
export const MISTAKE_CHANGED_EVENT = 'MistakeChangedEvent';
export const PLACE_DOG_USED_EVENT = 'PlaceDogUsedEvent';
export const HINT_SHOWN_EVENT = 'HintShownEvent';
export const BOARD_RESTARTED_EVENT = 'BoardRestartedEvent';
export const SCORE_CHANGED_EVENT = 'ScoreChangedEvent';
export const PUZZLE_SOLVED_EVENT = 'PuzzleSolvedEvent';
export const PUZZLE_FAILED_EVENT = 'PuzzleFailedEvent';
/** Bắn khi tutorial đặt xong 3 con chó được hướng dẫn (bước tự do bắt đầu) — GameplayScreen dùng để hiện lại HUD. */
export const TUTORIAL_GUIDED_FINISHED_EVENT = 'TutorialGuidedFinishedEvent';
/** Sóng chéo chúc mừng thắng màn (BoardView.playVictoryWave) đã chạy XONG — GameplayScreen dùng
 * làm mốc bắt đầu hiệu ứng tim còn lại bay vào label. Không có payload. */
export const VICTORY_WAVE_FINISHED_EVENT = 'VictoryWaveFinishedEvent';
/** Hiệu ứng tim còn lại bay vào label (GameplayScreen) đã kết thúc — bắn cả khi hiệu ứng bị bỏ qua
 * (chưa gán label/không còn tim) ngay tại thời điểm sóng thắng màn xong. UIManager dùng làm mốc mở
 * LeaderboardPreview. Không có payload. */
export const HEART_FLY_FINISHED_EVENT = 'HeartFlyFinishedEvent';
/** Bong bóng "encourage" (RuleFrameIntro.playEncourage) đã ẩn HẲN (pop-out xong, node.active = false)
 * — bắn cả khi không có gì để chạy (thiếu node, hoặc context tutorial không chạy encourage), để
 * không ai phải đợi mãi. HardLevelBadge dùng làm mốc mới được hiện hiệu ứng pop-in, tránh chồng
 * lên lúc encourage đang hiện/tắt. Không có payload. */
export const ENCOURAGE_HIDDEN_EVENT = 'EncourageHiddenEvent';
/** ResultPopup vừa HIỆN LÊN (onShow) — AudioManager dùng để phát âm thanh thắng màn ĐÚNG lúc popup
 * này mở ra, thay vì ngay lúc PUZZLE_SOLVED_EVENT bắn (có thể còn cách xa lúc popup thật sự mở, vd
 * đợi hiệu ứng sóng/tim bay/màn Streak chen giữa). */
export interface ResultPopupShownEventPayload {
    readonly outcome: 'win' | 'lose';
}
export const RESULT_POPUP_SHOWN_EVENT = 'ResultPopupShownEvent';

/**
 * Bắn ĐÚNG 1 LẦN (nếu có) từ PuzzleSession.autoMarkRemainingCells(), NGAY TRƯỚC PUZZLE_SOLVED_EVENT
 * — khi thắng màn mà còn ô Empty (người chơi KHÔNG cần tự đánh dấu X). Dữ liệu (board state + tổng
 * điểm) đã ĐÚNG NGAY LÚC BẮN — payload chỉ để lớp UI (BoardView/GameplayScreen) tự chọn THỜI ĐIỂM
 * và CÁCH hiển thị (dừng nhịp → hiện X → đốm sáng bay tới score label → điểm tăng), không ảnh
 * hưởng gì tới tính đúng đắn của gameplay nếu UI bỏ qua sự kiện này. KHÔNG bắn nếu không có ô nào
 * cần tự đánh dấu (tránh UI phải tự check length===0).
 */
export const AUTO_MARK_APPLIED_EVENT = 'AutoMarkAppliedEvent';

export interface AutoMarkAppliedEventPayload {
    readonly cells: readonly number[];
    readonly scoreGained: number;
    readonly totalScore: number;
}

export const DOG_SETTLED_EVENT = 'DogSettledEvent';

export interface DogSettledEventPayload {
    readonly cell: number;
}

export interface PuzzleReadyEventPayload {
    readonly context: PuzzleContext;
    readonly puzzleId: number;

    /** true khi puzzleId là level "khó" (campaign, mỗi 10 level từ 30) — chỉ đổi hiệu ứng hiển thị, data puzzle không đổi. Xem LevelListConfig.isHardLevel(). */
    readonly isHardLevel: boolean;

    readonly isResume: boolean;
    readonly size: number;
    readonly regions: readonly number[];
    readonly cellStates: readonly CellState[];
    readonly lockedCells: readonly number[];
    readonly mistakesRemaining: number;
    readonly maxMistakes: number;
    readonly placeDogCharges: number;
    readonly hintCharges: number;
    readonly totalDogs: number;
    readonly score: number;

    readonly tutorialGuidedCells?: readonly number[];

    /**
     * Board hiện lại ĐÚNG trạng thái vừa rời đi (không có gì thay đổi) — ví dụ quay lại
     * Gameplay từ màn Streak ăn mừng. Hiện NGAY, bỏ hẳn hiệu ứng scale/stagger "spawn"
     * từng ô như vào màn mới/resume ván dở.
     */
    readonly instant?: boolean;
}


export interface ScoreChangedEventPayload {

    readonly score: number;

    readonly gained: number;

    readonly cell: number;

    /** Số lần đặt đúng chó liên tiếp (combo) SAU sự kiện này — dùng để chọn mức hiệu ứng/âm thanh praise. */
    readonly streak: number;

    /** true khi con chó này do BOOSTER Place Dog tự đặt (PuzzleSession.handleUsePlaceDog), không
     * phải người chơi tự bấm ô — BoardView dùng để BỎ QUA hiệu ứng text khen (spawnPraiseEffect),
     * vì đây không phải hành động của người chơi. */
    readonly viaPlaceDog?: boolean;
}

export interface CellChangedEventPayload {
    readonly cell: number;
    readonly state: CellState;
    readonly wrongReason: WrongReason | null;
    /** true nếu thay đổi này đến từ việc Áp dụng gợi ý (Hint), không phải người chơi tự bấm.
     * BoardView dùng để tắt hiệu ứng "Clear" cho chính thao tác hint, không chặn thao tác thủ công sau đó. */
    readonly viaHint: boolean;
    /** true nếu state === Mark NHƯNG ô này thực ra cần đặt Dog theo solution (đánh dấu X nhầm,
     * khác WrongMark — WrongMark là đặt SAI CHÓ, cái này là đánh dấu X SAI, tự phát hiện được vì
     * PuzzleSession biết solution). BoardView dùng để chặn Clear trên hàng/cột có Mark sai. */
    readonly isMisplacedMark: boolean;
}

export interface MistakeChangedEventPayload {
    readonly remaining: number;
    readonly max: number;
}

export interface PlaceDogUsedEventPayload {
    readonly cell: number;
    readonly chargesRemaining: number;
}

export interface HintShownEventPayload {
    readonly hint: Hint | null;
    readonly chargesRemaining: number;
}


export interface BoardRestartedEventPayload {
    readonly puzzleId: number;
    readonly cellStates: readonly CellState[];
    readonly mistakesRemaining: number;
}

export interface PuzzleSolvedEventPayload {
    /** ConnectTracks owns its victory presentation; record completion without legacy win overlays. */
    readonly presentation?: 'connectTracksInline';
    readonly context: PuzzleContext;
    readonly puzzleId: number;
    /** Số tim (mistake) còn lại lúc thắng — dùng để tính điểm xếp hạng Weekly (GameManager.
     * pushLeaderboardScore) cho Dogdoku, KHÔNG liên quan tới điểm trong màn chơi (ScoreSystem). Vẫn
     * là nguồn điểm MẶC ĐỊNH khi `leaderboardScore` không được cung cấp. */
    readonly mistakesRemaining: number;
    /** Điểm xếp hạng Weekly GHI ĐÈ lên mistakesRemaining khi có — dùng cho ConnectTracks (xác nhận
     * từ user): điểm = số ô đường ray có trong màn chơi (độ dài đường ray hoàn chỉnh, bao gồm cả ô
     * given), KHÔNG còn tính theo số tim còn lại nữa. Dogdoku không gán field này nên vẫn dùng
     * mistakesRemaining như cũ. Xem GameplayScreen.notifyConnectTracksWon()/GameManager.onPuzzleSolved. */
    readonly leaderboardScore?: number;
}

export interface PuzzleFailedEventPayload {
    readonly context: PuzzleContext;
    readonly puzzleId: number;
}
