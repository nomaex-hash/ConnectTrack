import { _decorator, Component, Node, RichText, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, Tween, tween } from 'cc';
import { EventManager } from '../../core/EventManager';
import { CellState } from '../../core/CellState';
import { Hint, HintAction, HintKind, HintLineRef } from '../../core/Hint';
import { HINT_SHOWN_EVENT, HintShownEventPayload } from '../../event/PuzzleEvents';
import { IntentType } from '../../gameplay/PuzzleIntent';
import { PuzzleSessionHolder } from '../../gameplay/PuzzleSessionHolder';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { BoardView } from './BoardView';

const { ccclass, property } = _decorator;

const PREVIEW_POP_SECONDS = 0.18;
const PREVIEW_FROM_SCALE = 0.4;

const OVERLAY_ANIM_SECONDS = 0.28;
const OVERLAY_FROM_SCALE = 0.85;


@ccclass('HintController')
export class HintController extends Component {
    @property({ type: BoardView, tooltip: 'BoardView của màn chơi hiện tại. BẮT BUỘC.' })
    board: BoardView | null = null;

    @property({
        type: Node,
        tooltip:
            'Nền đen mờ full màn — BẮT BUỘC. Có thể tái dùng thẳng node "Grey" của Tutorial ' +
            '(TutorialOverlay/Spotlight/Grey) để test nhanh, không cần dựng node riêng.',
    })
    dimNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Node cha nhận ô được nhấc lên (truyền vào BoardView.liftCellsTo). Để TRỐNG thì tự ' +
            'tạo 1 node runtime làm con của chính node này — không bắt buộc gán trong Editor.',
    })
    spotlightLayer: Node | null = null;

    @property({ type: Node, tooltip: 'Khung mô tả gợi ý (chứa textLabel). Để trống thì bỏ qua, không hiện text.' })
    textNode: Node | null = null;

    @property({
        type: RichText,
        tooltip:
            'RichText mô tả gợi ý bên trong textNode — dùng RichText (không phải Label) vì ' +
            'text có thể chèn BBCode <color=#..> để tô đúng màu vùng qua token "{color}".',
    })
    textLabel: RichText | null = null;

    @property({
        range: [1, 2, 0.01],
        slide: true,
        tooltip:
            'Cỡ chữ của {colors}/{lines} so với cỡ chữ gốc của textLabel (vd 1.2 = to hơn 20%). ' +
            'BBCode <size> cần giá trị px tuyệt đối nên phải tính lại mỗi lần dựa trên fontSize hiện tại.',
    })
    emphasisSizeRatio = 1.2;

    @property({
        type: Node,
        tooltip:
            'Nút "Áp dụng" — gắn clickEvents trỏ tới onTapApply() của component này. Để TRỐNG ' +
            'thì bấm vào BẤT KỲ ĐÂU trên dimNode cũng áp dụng gợi ý (fallback tạm để test).',
    })
    applyButtonNode: Node | null = null;

    @property({
        type: SpriteFrame,
        tooltip:
            'Sprite mèo xem trước — hiện TĨNH tại ô cần đặt (HintAction.PlaceDog), KHÔNG còn tay ' +
            'trỏ animation nữa. Để trống thì bỏ qua, chỉ nhấc ô lên.',
    })
    placeDogPreviewSpriteFrame: SpriteFrame | null = null;

    @property({
        range: [0.3, 1, 0.01],
        slide: true,
        tooltip: 'Cạnh dài nhất của sprite mèo so với cạnh ô; giữ nguyên tỷ lệ rộng/cao của ảnh.',
    })
    placeDogPreviewSizeRatio = 0.7;

    @property({
        type: SpriteFrame,
        tooltip:
            'Sprite dấu X xem trước — sprite TĨNH (KHÔNG còn spine animation Active_correct/ ' +
            'Idle_correct như trước). Hiện tại các ô cần đánh dấu (HintAction.MarkCells) TRƯỚC khi ' +
            'bấm Áp dụng.',
    })
    xPreviewSpriteFrame: SpriteFrame | null = null;

    @property({
        range: [0.3, 1, 0.01],
        slide: true,
        tooltip: 'Sprite X xem trước chiếm bao nhiêu phần cạnh ô.',
    })
    xPreviewSizeRatio = 0.7;

    @property({
        range: [0, 255, 1],
        slide: true,
        tooltip: 'Opacity thấp nhất khi sprite xem trước (mèo/X) nhấp nháy. Cao nhất luôn là 255.',
    })
    previewBlinkMinOpacity = 110;

    @property({ tooltip: 'Thời gian 1 nhịp mờ đi (hoặc đậm lại) của sprite xem trước — giây.' })
    previewBlinkHalfSeconds = 0.45;

    private currentHint: Hint | null = null;
    private readonly previewNodes: Node[] = [];

    onLoad(): void {
        if (!this.board) {
            console.error(
                '[HintController] Field "board" chưa gán BoardView trong Editor — ô gợi ý sẽ không được nhấc lên và sprite mèo/X xem trước sẽ KHÔNG hiện.',
            );
        }
        EventManager.instance.on<HintShownEventPayload>(HINT_SHOWN_EVENT, this.onHintShown, this);
        if (this.applyButtonNode) this.applyButtonNode.active = false;
        if (this.textNode) this.textNode.active = false;
        if (this.dimNode) {
            this.dimNode.active = false;
   
            if (!this.applyButtonNode) this.dimNode.on(Node.EventType.TOUCH_END, this.onTapApply, this);
        }
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        if (this.dimNode?.isValid) this.dimNode.off(Node.EventType.TOUCH_END, this.onTapApply, this);
        this.teardownInstant();
    }

    private onHintShown = (payload: HintShownEventPayload): void => {
        if (payload.hint) this.showHint(payload.hint);
    };

    private showHint(hint: Hint): void {
        this.teardownInstant();
        this.currentHint = hint;

        this.playShowAnimated(this.dimNode);
        // Đánh dấu quanh mèo: chỉ preview X + nhấc các ô người chơi CHƯA đánh dấu (Empty) và ô
        // chứa mèo của hint đó; ô đã đánh dấu không nhấc. Hint khác chỉ nhấc ô đích.
        const marksAroundDog = hint.kind === HintKind.SingleCandidate && hint.action === HintAction.MarkCells;
        const states = PuzzleSessionHolder.current?.cellStates;
        const markPreviewCells =
            hint.action === HintAction.MarkCells
                ? marksAroundDog && states
                    ? hint.highlightCells.filter((cell) => states[cell] === CellState.Empty)
                    : hint.targetCells
                : [];
        const dogCells =
            marksAroundDog && states ? hint.highlightCells.filter((cell) => states[cell] === CellState.Dog) : [];
        // Contradiction cần nhấc THÊM các ô ứng viên còn lại của màu nạn nhân (eliminatedCandidateCells)
        // — dù không nằm trong targetCells, chúng vẫn cần hiện ra (có sprite X hoặc chỉ nhấc lên, xem
        // showContradictionPreview()).
        const contradictionExtraCells = hint.kind === HintKind.Contradiction ? hint.eliminatedCandidateCells ?? [] : [];
        // ColorsLockedInLines/FullLineColor: nhấc CẢ các ô thuộc (các) màu đang được nhắc tới
        // (regionIds) — highlightCells đã gồm sẵn toàn bộ ô trong (các) hàng/cột liên quan, kể cả
        // ô của những màu đó — không sprite gì cả, chỉ targetCells (màu KHÔNG được nhắc) mới có X.
        // Ô ĐÃ đánh dấu X (state Mark) KHÔNG bao giờ được nhấc — chỉ còn ý nghĩa hiển thị với ô
        // Empty (chưa đánh dấu) hoặc Dog (đã đặt mèo).
        const liftFullHighlight = hint.kind === HintKind.ColorsLockedInLines || hint.kind === HintKind.FullLineColor;
        const liftableHighlightCells =
            liftFullHighlight && states ? hint.highlightCells.filter((cell) => states[cell] !== CellState.Mark) : hint.highlightCells;
        const spotlightCells =
            hint.action === HintAction.MarkCells
                ? liftFullHighlight
                    ? liftableHighlightCells
                    : markPreviewCells.concat(dogCells, contradictionExtraCells)
                : hint.targetCells;
        this.board?.liftCellsTo(this.resolveSpotlightLayer(), spotlightCells);

        if (this.textLabel) this.textLabel.string = this.buildText(hint);
        this.playShowAnimated(this.textNode);
        this.playShowAnimated(this.applyButtonNode);

        if (hint.action === HintAction.PlaceDog) {
            this.showPreviewSprite(hint.handAnchorCell ?? hint.targetCells[0]!, this.placeDogPreviewSpriteFrame, this.placeDogPreviewSizeRatio);
        } else if (hint.kind === HintKind.Contradiction) {
            this.showContradictionPreview(hint);
        } else if (hint.action === HintAction.MarkCells) {
            for (const cell of markPreviewCells) this.showPreviewSprite(cell, this.xPreviewSpriteFrame, this.xPreviewSizeRatio);
        }
    }

    /** HintKind.Contradiction có 2 nhánh hiển thị tuỳ số ô "thủ phạm" (targetCells):
     * - ĐÚNG 1 ô: đó là thủ phạm DUY NHẤT -> hiện sprite MÈO xem trước (dùng chung sprite/size
     *   với HintAction.PlaceDog); các ô ứng viên còn lại của màu nạn nhân (eliminatedCandidateCells)
     *   -> sprite X xem trước.
     * - NHIỀU hơn 1 ô: tất cả targetCells đều là thủ phạm cần đánh dấu -> sprite X xem trước; các
     *   ô ứng viên còn lại chỉ được nhấc lên (đã lift ở showHint()), KHÔNG sprite gì cả. */
    private showContradictionPreview(hint: Hint): void {
        const victimCandidates = hint.eliminatedCandidateCells ?? [];
        if (hint.targetCells.length === 1) {
            this.showPreviewSprite(hint.targetCells[0]!, this.placeDogPreviewSpriteFrame, this.placeDogPreviewSizeRatio);
            for (const cell of victimCandidates) this.showPreviewSprite(cell, this.xPreviewSpriteFrame, this.xPreviewSizeRatio);
        } else {
            for (const cell of hint.targetCells) this.showPreviewSprite(cell, this.xPreviewSpriteFrame, this.xPreviewSizeRatio);
        }
    }


    private resolveSpotlightLayer(): Node {
        if (this.spotlightLayer?.isValid) return this.spotlightLayer;

        const node = new Node('HintSpotlightLayer');
        node.layer = this.node.layer;
        node.addComponent(UITransform);
        node.setParent(this.node);
        node.setPosition(0, 0, 0);

        this.spotlightLayer = node;
        return node;
    }


    onTapApply(): void {
        if (!this.currentHint) return;

        this.currentHint = null;
 
        this.board?.restoreLiftedCells();
        this.destroyPreviews();

        const session = PuzzleSessionHolder.current;
        session?.dispatch({ type: IntentType.ApplyHint });

        this.playHideAnimated(this.dimNode);
        this.playHideAnimated(this.textNode);
        this.playHideAnimated(this.applyButtonNode);
    }

    private resolveTextKey(hint: Hint): string {
        switch (hint.kind) {
            case HintKind.MisplacedMark:
                return L10N.hint.misplacedMark;
            case HintKind.SingleCandidate:
                return hint.action === HintAction.PlaceDog
                    ? L10N.hint.placeDogSingleCandidate
                    : L10N.hint.markAroundDog;
            case HintKind.ColorsLockedInLines:
                return L10N.hint.markColorsLocked;
            case HintKind.FullLineColor:
                return L10N.hint.markFullLineColor;
            case HintKind.Contradiction:
                return hint.targetCells.length > 1 ? L10N.hint.markContradictionPlural : L10N.hint.markContradiction;
            case HintKind.RandomReveal:
                return L10N.hint.randomReveal;
            default:
                return L10N.hint.randomReveal;
        }
    }

    /** Lấy text theo resolveTextKey() rồi thay token "{colors}"/"{lines}" nếu hint có đủ dữ liệu. */
    private buildText(hint: Hint): string {
        let text = Localization.get(this.resolveTextKey(hint));
        const emphasisSize = Math.round((this.textLabel?.fontSize ?? 40) * this.emphasisSizeRatio);

        // Token "{n}" — số ô, hiện dùng cho hint.markContradictionPlural ("N ô này sai vì..."). Các
        // key khác không có token này nên replace() không tác dụng, an toàn để gọi vô điều kiện.
        text = text.replace('{n}', `${hint.targetCells.length}`);
        if (hint.regionIds && hint.regionIds.length > 0) {
            // Viết hoa chữ cái đầu tên màu CHỈ khi "{colors}" đứng ĐẦU câu (vd "Xanh lá chỉ còn 1
            // ô duy nhất!") — giữ nguyên chữ thường khi nằm giữa câu (vd "...ứng viên màu xanh lá").
            const capitalizeFirst = text.startsWith('{colors}');
            text = text.replace('{colors}', this.formatColorList(hint.regionIds, emphasisSize, capitalizeFirst));
        }
        if (hint.lines && hint.lines.length > 0) {
            text = text.replace('{lines}', this.formatLineList(hint.lines));
        }
        return text;
    }

    /** "xanh lá và hồng" (mỗi tên tô đúng màu vùng, cỡ chữ to hơn) — tra bảng BoardView.regionColors.
     * @param capitalizeFirst viết hoa chữ cái đầu của TÊN MÀU ĐẦU TIÊN trong danh sách (dùng khi
     * "{colors}" đứng đầu câu — xem buildText()). */
    private formatColorList(regionIds: readonly number[], emphasisSize: number, capitalizeFirst = false): string {
        return this.joinWithAnd(
            regionIds.map((id, index) => this.formatColorName(id, emphasisSize, capitalizeFirst && index === 0)),
        );
    }

    /** "hàng 2 và cột 5" — mỗi mục tự chọn đúng chữ "hàng"/"cột" theo axis, hiển thị 1-based. */
    private formatLineList(lines: readonly HintLineRef[]): string {
        return this.joinWithAnd(
            lines.map((line) => {
                const axisWord = Localization.get(line.axis === 'row' ? L10N.common.row : L10N.common.col);
                return `${axisWord} ${line.index + 1}`;
            }),
        );
    }

    /** "A" / "A và B" / "A, B và C" — nối danh sách theo kiểu liệt kê tiếng Việt/Anh. */
    private joinWithAnd(items: readonly string[]): string {
        if (items.length === 0) return '';
        if (items.length === 1) return items[0]!;

        const and = Localization.get(L10N.common.and);
        return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
    }

    /** "<color=#hex>tên màu</color>" (cỡ chữ to hơn) cho 1 regionId — tra bảng BoardView.regionColors.
     * @param capitalize viết hoa chữ cái đầu tên màu (trước khi bọc thẻ rich text). */
    private formatColorName(regionId: number, emphasisSize: number, capitalize = false): string {
        const entry = this.board?.getRegionColorEntry(regionId);
        if (!entry) return '';

        let name = entry.nameKey ? Localization.get(entry.nameKey) : '';
        if (capitalize && name.length > 0) name = name.charAt(0).toUpperCase() + name.slice(1);
        const hex = entry.color.toHEX('#rrggbb');
        return `<color=#${hex}><size=${emphasisSize}>${name}</size></color>`;
    }

    /** Hiện 1 sprite TĨNH tại `cell` (dấu X xem trước HOẶC mèo xem trước, dùng chung 1 cơ chế) —
     * KHÔNG còn animation spine/hand-pointer nào nữa, chỉ pop-in opacity + scale (giống hệt
     * PREVIEW_POP_SECONDS/PREVIEW_FROM_SCALE đã dùng trước đây cho dấu X). */
    private showPreviewSprite(cell: number, spriteFrame: SpriteFrame | null, sizeRatio: number): void {
        if (!spriteFrame || !this.board) return;

        const pos = new Vec3();
        if (!this.board.getCellWorldPosition(cell, pos)) return;

        const node = new Node('HintPreviewSprite');
        node.layer = this.node.layer;

        const size = this.board.currentVisualCellSize * sizeRatio;
        const transform = node.addComponent(UITransform);

        const sprite = node.addComponent(Sprite);
        // Mặc định Sprite dùng kích thước ảnh gốc khi gán spriteFrame, ghi đè tỷ lệ ô.
        // Cả X và mèo preview phải dùng kích thước do Inspector quy định.
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = spriteFrame;
        // Vừa trong kích thước cấu hình, giữ tỷ lệ ảnh chữ nhật thay vì kéo thành hình vuông.
        const { width, height } = spriteFrame.rect;
        const longestSide = Math.max(width, height);
        if (width > 0 && height > 0) {
            const fitScale = size / longestSide;
            transform.setContentSize(width * fitScale, height * fitScale);
        } else {
            transform.setContentSize(size, size);
        }

        const layer = this.resolveSpotlightLayer();
        node.setParent(layer);
        node.setWorldPosition(pos);
        // Cùng cha với ô vừa được nhấc lên — đảm bảo sprite luôn vẽ TRÊN CÙNG, không bị ô che.
        node.setSiblingIndex(layer.children.length - 1);

        const opacity = node.addComponent(UIOpacity);
        opacity.opacity = 0;
        node.setScale(PREVIEW_FROM_SCALE, PREVIEW_FROM_SCALE, 1);

        tween(node).to(PREVIEW_POP_SECONDS, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        // Pop-in xong thì nhấp nháy opacity lặp vô hạn cho tới khi destroyPreviews().
        tween(opacity)
            .to(PREVIEW_POP_SECONDS, { opacity: 255 })
            .call(() => this.startPreviewBlink(opacity))
            .start();

        this.previewNodes.push(node);
    }

    private startPreviewBlink(opacity: UIOpacity): void {
        if (!opacity.isValid) return;

        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        const blinkCycle = tween(opacity)
            .to(this.previewBlinkHalfSeconds, { opacity: this.previewBlinkMinOpacity })
            .to(this.previewBlinkHalfSeconds, { opacity: 255 });
        tween(opacity).repeatForever(blinkCycle).start();
    }

    /** Hiện dimNode/textNode/applyButtonNode: scale nhỏ→lớn + mờ→đậm. */
    private playShowAnimated(node: Node | null): void {
        if (!node?.isValid) return;

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        node.active = true;
        node.setScale(OVERLAY_FROM_SCALE, OVERLAY_FROM_SCALE, 1);
        opacity.opacity = 0;

        tween(node).to(OVERLAY_ANIM_SECONDS, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        tween(opacity).to(OVERLAY_ANIM_SECONDS, { opacity: 255 }).start();
    }

    /** Ẩn dimNode/textNode/applyButtonNode: scale lớn→nhỏ + đậm→mờ, xong mới tắt active. */
    private playHideAnimated(node: Node | null): void {
        if (!node?.isValid || !node.active) return;

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        tween(node)
            .to(OVERLAY_ANIM_SECONDS, { scale: new Vec3(OVERLAY_FROM_SCALE, OVERLAY_FROM_SCALE, 1) }, { easing: 'quadIn' })
            .start();
        tween(opacity)
            .to(OVERLAY_ANIM_SECONDS, { opacity: 0 })
            .call(() => {
                if (node.isValid) node.active = false;
            })
            .start();
    }

    private destroyPreviews(): void {
        for (const node of this.previewNodes) {
            if (node.isValid) {
                Tween.stopAllByTarget(node);
                const opacity = node.getComponent(UIOpacity);
                if (opacity) Tween.stopAllByTarget(opacity);
                node.destroy();
            }
        }
        this.previewNodes.length = 0;
    }

    /** Tắt NGAY LẬP TỨC, không hiệu ứng — dùng lúc huỷ component hoặc trước khi hiện gợi ý MỚI. */
    private teardownInstant(): void {
        this.currentHint = null;

        for (const node of [this.dimNode, this.textNode, this.applyButtonNode]) {
            if (!node?.isValid) continue;
            Tween.stopAllByTarget(node);
            const opacity = node.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
            node.active = false;
        }

        if (this.board?.isValid) this.board.restoreLiftedCells();
        this.destroyPreviews();
    }
}
