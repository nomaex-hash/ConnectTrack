

export enum HintAction {
    /** Đặt chó vào đúng 1 ô (targetCells có đúng 1 phần tử). */
    PlaceDog = 'PlaceDog',
    /** Đánh dấu X vào 1 hoặc nhiều ô cùng lúc. */
    MarkCells = 'MarkCells',
    /** Gỡ 1 ô đang bị đánh dấu X sai (về lại ô trống) — chỉ dùng cho HintKind.MisplacedMark. */
    ClearMark = 'ClearMark',
}

/** Kỹ thuật suy luận đã sinh ra gợi ý — dùng để chọn text mô tả hiển thị. */
export enum HintKind {
    /** Bước 0 — người chơi đã đánh dấu X nhầm vào 1 ô lẽ ra là lời giải. */
    MisplacedMark = 'MisplacedMark',
    /** Bước 1 — 1 màu chỉ còn đúng 1 ô khả dĩ (đặt chó, hoặc dọn quanh chó vừa đặt). */
    SingleCandidate = 'SingleCandidate',
    /** Bước 2 + 3 gộp — N màu (N=1,2,3) chỉ nằm gọn trong đúng N hàng/cột. */
    ColorsLockedInLines = 'ColorsLockedInLines',
    /** Bước 4 — 1 hàng/cột toàn bộ ô (kể cả đã đánh dấu) đều cùng 1 màu. */
    FullLineColor = 'FullLineColor',
    /** Bước 5 — đặt thử 1 ô khiến màu khác về 0 ứng viên (mâu thuẫn). */
    Contradiction = 'Contradiction',
    /** Bước 6 — dự phòng, tiết lộ ngẫu nhiên 1 ô lời giải. */
    RandomReveal = 'RandomReveal',
}

export interface HintLineRef {
    readonly axis: 'row' | 'col';
    readonly index: number;
}

export interface Hint {
    readonly kind: HintKind;
    readonly action: HintAction;

    /** Ô THỰC SỰ bị tác động khi bấm "Áp dụng". */
    readonly targetCells: readonly number[];

    /**
     * Các ô liên quan đến bước suy luận, gồm targetCells và ô ngữ cảnh đã có chó/X.
     * Hint đánh dấu quanh mèo làm nổi cả nhóm này; các loại hint khác chỉ làm nổi targetCells.
     */
    readonly highlightCells: readonly number[];

    /** Chỉ có khi action = PlaceDog — vị trí handAnim trỏ vào (luôn = targetCells[0]). */
    readonly handAnchorCell?: number;

    /**
     * (Các) vùng/màu mà gợi ý đang nhắc tới — có khi text mô tả cần chèn tên màu (token
     * "{colors}", tự nối "A và B" nếu nhiều hơn 1). VD ColorsLockedInLines n=2,3 có thể liệt
     * kê nhiều màu cùng lúc trong 1 câu.
     */
    readonly regionIds?: readonly number[];

    /**
     * (Các) hàng/cột mà gợi ý đang nhắc tới — có khi text mô tả cần chèn "hàng N"/"cột N"
     * (token "{lines}", tự nối nếu nhiều hơn 1). Index 0-based nội bộ, HintController hiển
     * thị 1-based cho người chơi.
     */
    readonly lines?: readonly HintLineRef[];

    /**
     * CHỈ dùng cho HintKind.Contradiction — (các) ô ứng viên CÒN LẠI của màu bị loại hết
     * (regionIds), hiện THÊM ngoài targetCells nhưng KHÔNG bị đánh dấu khi bấm "Áp dụng" (chỉ để
     * minh hoạ vì sao targetCells sai). HintController chọn sprite theo số lượng targetCells:
     *   - targetCells có ĐÚNG 1 ô (chỉ 1 ô duy nhất gây mâu thuẫn): ô đó hiện sprite MÈO xem
     *     trước, còn các ô trong field này hiện sprite X xem trước.
     *   - targetCells có NHIỀU HƠN 1 ô: tất cả targetCells hiện sprite X xem trước, còn các ô
     *     trong field này chỉ được nhấc lên (không sprite gì cả).
     */
    readonly eliminatedCandidateCells?: readonly number[];
}
