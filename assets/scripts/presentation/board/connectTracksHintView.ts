import { _decorator, BlockInputEvents, Color, Component, Graphics, Node, RichText, Sprite, UITransform, Vec3, instantiate, isValid, warn } from 'cc';
import { TrackHint } from '../../domain/rules/trackHint';
import { trackOrientationOf } from './trackOrientation';
import { ConnectTracksBoardView } from './connectTracksBoardView';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
const { ccclass, property } = _decorator;

/** BUG đã sửa (báo lỗi của user: "bấm hint ở tut thì text hướng dẫn lại là tiếng việt" dù máy đang
 * để tiếng Anh) — TrackHint.text (domain/rules/trackHint.ts) hardcode thẳng tiếng Việt, không qua
 * Localization. Domain chỉ còn dùng để GIẢI THÍCH LOGIC qua `rule`; text hiển thị thật PHẢI map
 * qua đây, không được đọc thẳng hint.text nữa. Rule A8 không có text hiển thị (áp dụng thẳng, xem
 * ConnectTracksTutorialController) nên không cần key. */
function hintRuleText(rule: TrackHint['rule']): string {
    switch (rule) {
        case 'A0': return Localization.get(L10N.connectTracksHint.removeX);
        case 'A1': return Localization.get(L10N.connectTracksHint.trackAtEdge);
        case 'A2': return Localization.get(L10N.connectTracksHint.lineComplete);
        case 'A3': return Localization.get(L10N.connectTracksHint.onlyOpenDirection);
        case 'A4': return Localization.get(L10N.connectTracksHint.lineNeedsRest);
        case 'A5': return Localization.get(L10N.connectTracksHint.deadEnd);
        case 'A6': return Localization.get(L10N.connectTracksHint.wouldExceed);
        case 'B1-preview': return Localization.get(L10N.connectTracksHint.shapeFromNeighbor);
        case 'B1-wrong': return Localization.get(L10N.connectTracksHint.shapeWrong);
        case 'A8': return '';
    }
}

/** `cells` tạo thành ĐÚNG 1 hàng hoặc 1 cột trọn vẹn (không thiếu/thừa ô nào) — dùng để biết khi
 * nào cần hiện lineClueHighlightLabel của board (Hint A2/A4/A5 có thể nhấc nguyên 1 hàng/cột). */
function detectFullLine(cells: readonly number[], width: number, height: number): { axis: 'row' | 'column'; line: number } | null {
    if (cells.length === width) {
        const row = Math.floor(cells[0]! / width);
        if (cells.every((c) => Math.floor(c / width) === row)) return { axis: 'row', line: row };
    }
    if (cells.length === height) {
        const col = cells[0]! % width;
        if (cells.every((c) => c % width === col)) return { axis: 'column', line: col };
    }
    return null;
}

/** Screen overlay only; decisions and mutations are supplied by GameSession. */
@ccclass('ConnectTracksHintView')
export class ConnectTracksHintView extends Component {
    @property(Node) dimNode: Node | null = null;
    @property(Node) content: Node | null = null;
    @property({ type: Node, tooltip: 'Nút Áp dụng. Để trống dùng node con Content/btnApply.' })
    applyButtonNode: Node | null = null;
    @property(RichText) textLabel: RichText | null = null;
    @property({ type: Node, tooltip: 'Node mẫu chỉ chứa sprite viền trắng. Tự fit cell và tint theo loại Hint.' })
    targetBorderNode: Node | null = null;
    @property({ min: 0, tooltip: 'Viền ô mục tiêu nới ra mỗi cạnh bao nhiêu đơn vị local của Board. Cạnh viền = cạnh cell + 2 × giá trị này.' })
    targetBorderPadding = 0;
    @property(Color) correctBorderColor = new Color(40, 200, 80, 255);
    @property(Color) errorBorderColor = new Color(255, 85, 85, 255);
    @property({ min: 0, tooltip: 'Độ dày viền ngoài vùng ô được nhấc, theo đơn vị local của Board. 0 để ẩn.' })
    regionBorderWidth = 3;
    @property({ type: Color, tooltip: 'Màu viền ngoài vùng ô được nhấc trong Hint.' })
    regionBorderColor = new Color(124, 126, 150, 255);
    @property({
        min: 0,
        tooltip:
            'Độ dày line NGĂN CÁCH các ô BÊN TRONG vùng được nhấc — vùng nhấc đã tách khỏi ' +
            'gridGraphics gốc của board nên tự nó không còn line chia ô (xác nhận từ user: phải vẽ ' +
            'lại). 0 để tắt.',
    })
    cellSeparatorWidth = 2;
    @property({ type: Color, tooltip: 'Màu line ngăn cách ở trên — nên khớp màu line grid thật của board.' })
    cellSeparatorColor = new Color(255, 255, 255, 160);
    @property(Node) previewNode: Node | null = null;
    @property(Node) xNode: Node | null = null;
    @property({ min: 0.01, step: 0.05, tooltip: 'Tỷ lệ khung dấu X xám so với cell. 1 = bằng cell; 1.2 = lớn hơn 20%. Chỉ áp dụng cho X xem trước của Hint.' })
    xPreviewSizeRatio = 1;
    @property(Node) straightHorizontalNode: Node | null = null;
    @property(Node) straightVerticalNode: Node | null = null;
    @property(Node) curveTopLeftNode: Node | null = null;
    @property(Node) curveTopRightNode: Node | null = null;
    @property(Node) curveBottomLeftNode: Node | null = null;
    @property(Node) curveBottomRightNode: Node | null = null;
    private layer: Node | null = null;
    private hiddenTracks: { board: ConnectTracksBoardView; cells: readonly number[] } | null = null;
    private lifted: { node: Node; parent: Node; index: number; position: Vec3; scale: Vec3 }[] = [];
    /** Board đang hiện Hint này — chỉ để gọi hideLineClueHighlight() đúng board lúc close(). */
    private liftedBoard: ConnectTracksBoardView | null = null;
    private apply: (() => void) | null = null;
    private dismiss: (() => void) | null = null;
    get showing(): boolean { return this.layer !== null; }

    onLoad(): void {
        if (!this.showing) {
            if (this.dimNode) this.dimNode.active = false;
            if (this.content) this.content.active = false;
            this.setApplyVisible(false);
        }
    }

    show(hint: TrackHint, board: ConnectTracksBoardView, width: number, height: number,
        apply: () => void, dismiss: () => void): boolean {
        if (!this.dimNode || !this.content || !this.textLabel || this.showing) return false;
        const orientation = trackOrientationOf(hint.directions);
        const template = hint.action === 'shape' ? (orientation ? this[`${orientation}Node`] : null)
            : hint.action === 'preview' ? this.previewNode : hint.action === 'markX' ? this.xNode : null;
        if (hint.action !== 'removeX' && (!template || !isValid(template, true))) {
            warn('[ConnectTracksHintView] Assign the preview template node for this hint before using it.');
            return false;
        }
        const templateRect = template?.getComponent(UITransform);
        if (template && (!templateRect || !Number.isFinite(templateRect.width) || !Number.isFinite(templateRect.height)
            || templateRect.width <= 0 || templateRect.height <= 0)) {
            warn('[ConnectTracksHintView] Template root needs a UITransform with positive width/height.');
            return false;
        }
        const nodes = hint.lifted.map(c => board.getHintCellNode(c));
        const borderRect = this.targetBorderNode && isValid(this.targetBorderNode, true)
            ? this.targetBorderNode.getComponent(UITransform) : null;
        if (this.targetBorderNode && (!isValid(this.targetBorderNode, true) || !borderRect
            || !Number.isFinite(borderRect.width) || !Number.isFinite(borderRect.height)
            || borderRect.width <= 0 || borderRect.height <= 0
            || !(this.targetBorderNode.getComponent(Sprite) ?? this.targetBorderNode.getComponentInChildren(Sprite)))) {
            warn('[ConnectTracksHintView] Border template needs a positive UITransform and a Sprite.');
            return false;
        }
        if (nodes.some(n => !n || !isValid(n, true) || !n.parent)) return false;
        this.node.active = true;
        this.node.setSiblingIndex(-1);
        this.dimNode.active = true;
        this.dimNode.getComponent(BlockInputEvents) ?? this.dimNode.addComponent(BlockInputEvents);
        const layer = new Node('HintCells');
        layer.layer = board.node.layer;
        layer.addComponent(UITransform);
        layer.parent = this.node;
        layer.setWorldPosition(board.node.worldPosition);
        layer.setWorldRotation(board.node.worldRotation);
        layer.setWorldScale(board.node.worldScale);
        this.layer = layer;
        if (hint.action === 'shape') {
            this.hiddenTracks = { board, cells: hint.targets };
            board.setHintTracksHidden(hint.targets, true);
        }
        this.apply = apply; this.dismiss = dismiss;
        this.liftedBoard = board;
        const fullLine = detectFullLine(hint.lifted, width, height);
        if (fullLine) board.showLineClueHighlight(fullLine.axis, fullLine.line, layer);
        else board.hideLineClueHighlight();
        // Capture every index before reparenting any cell.
        this.lifted = nodes.map(n => ({ node: n!, parent: n!.parent!, index: n!.getSiblingIndex(),
            position: n!.position.clone(), scale: n!.scale.clone() }));
        for (const item of this.lifted) item.node.setParent(layer, true);
        const cellSize = board.getCellSize();
        const xy = (c: number) => ({ x: (c % width - width / 2) * cellSize,
            y: (height / 2 - Math.floor(c / width) - 1) * cellSize });
        const cloneAtCell = (source: Node, rect: UITransform, c: number, padding = 0, sizeRatio = 1): Node => {
            const n = instantiate(source);
            const setLayer = (node: Node): void => {
                node.layer = layer.layer;
                for (const child of node.children) setLayer(child);
            };
            setLayer(n);
            n.parent = layer;
            const p = xy(c);
            const size = cellSize * sizeRatio + padding * 2;
            const sx = size / rect.width * (source.scale.x < 0 ? -1 : 1);
            const sy = size / rect.height * (source.scale.y < 0 ? -1 : 1);
            n.setScale(sx, sy, source.scale.z);
            n.setPosition(p.x + cellSize / 2 + (rect.anchorX - .5) * rect.width * sx,
                p.y + cellSize / 2 + (rect.anchorY - .5) * rect.height * sy, source.position.z);
            n.active = true;
            // Fit the template's full design rectangle to one cell. Child art retains its authored proportions.
            return n;
        };
        const xRatio = Number.isFinite(this.xPreviewSizeRatio) ? Math.max(0.01, this.xPreviewSizeRatio) : 1;
        for (const c of hint.targets) if (template)
            cloneAtCell(template, templateRect!, c, 0, hint.action === 'markX' ? xRatio : 1);
        const borders = new Node('HintBorders'); borders.layer = layer.layer; borders.parent = layer;
        borders.addComponent(UITransform);
        const g = borders.addComponent(Graphics);
        const set = new Set(hint.lifted);
        const edge = (x1: number, y1: number, x2: number, y2: number) => { g.moveTo(x1, y1); g.lineTo(x2, y2); };
        // Line NGĂN CÁCH các ô bên trong vùng nhấc (xác nhận từ user) — chỉ xét cạnh TRÁI/TRÊN của
        // mỗi ô để mỗi đường chung chỉ vẽ đúng 1 lần.
        if (this.cellSeparatorWidth > 0) {
            g.lineWidth = this.cellSeparatorWidth;
            g.strokeColor = this.cellSeparatorColor;
            for (const c of hint.lifted) {
                const { x, y } = xy(c), s = cellSize, col = c % width, row = Math.floor(c / width);
                if (col > 0 && set.has(c - 1)) edge(x, y, x, y + s);
                if (row > 0 && set.has(c - width)) edge(x, y + s, x + s, y + s);
            }
            g.stroke();
        }
        if (this.regionBorderWidth > 0) {
            g.lineWidth = this.regionBorderWidth;
            g.strokeColor = this.regionBorderColor;
            for (const c of hint.lifted) {
                const { x, y } = xy(c), s = cellSize, col = c % width, row = Math.floor(c / width);
                if (col === 0 || !set.has(c - 1)) edge(x, y, x, y + s);
                if (col === width - 1 || !set.has(c + 1)) edge(x + s, y, x + s, y + s);
                if (row === 0 || !set.has(c - width)) edge(x, y + s, x + s, y + s);
                if (row === height - 1 || !set.has(c + width)) edge(x, y, x + s, y);
            }
            g.stroke();
        }
        const borderColor = hint.error ? this.errorBorderColor : this.correctBorderColor;
        const padding = Number.isFinite(this.targetBorderPadding) ? Math.max(0, this.targetBorderPadding) : 0;
        if (this.targetBorderNode) {
            for (const c of hint.targets) {
                const n = cloneAtCell(this.targetBorderNode, borderRect!, c, padding);
                // Only border copies are tinted. Track/X art and the white template stay unchanged.
                for (const sprite of n.getComponentsInChildren(Sprite)) sprite.color = borderColor.clone();
            }
        } else {
            // Keep existing prefabs usable until the border template is assigned in Editor.
            // Separate fallback target borders from the configurable region perimeter.
            const targets = new Node('HintTargetBorders'); targets.layer = layer.layer; targets.parent = layer;
            targets.addComponent(UITransform);
            const targetGraphics = targets.addComponent(Graphics);
            targetGraphics.lineWidth = 3;
            targetGraphics.strokeColor = borderColor;
            for (const c of hint.targets) {
                const p = xy(c);
                targetGraphics.rect(p.x + 2 - padding, p.y + 2 - padding, cellSize - 4 + 2 * padding, cellSize - 4 + 2 * padding);
            }
            targetGraphics.stroke();
        }
        // BUG đã sửa (báo lỗi của user, kèm ảnh chụp): viền xanh (targetBorderNode) phải nổi TRÊN
        // line xám ngăn cách ô (cellSeparatorWidth) — trước đây ép borders.setSiblingIndex(-1) đẩy
        // line xám lên TRÊN CÙNG, cắt ngang/đè lên viền xanh ở đúng cạnh chung giữa 2 ô target. Thứ
        // tự tạo node TỰ NHIÊN đã đúng rồi (borders tạo TRƯỚC viền xanh ở trên) — không cần (và
        // không được) ép lại sibling index nữa.
        this.textLabel.string = hintRuleText(hint.rule);
        this.content.active = true; this.content.setSiblingIndex(-1);
        this.setApplyVisible(true);
        return true;
    }

    private setApplyVisible(visible: boolean): void {
        const button = this.applyButtonNode ?? (this.content && isValid(this.content, true)
            ? this.content.getChildByName('btnApply') : null);
        if (button && isValid(button, true)) button.active = visible;
    }

    onTapApply(): void { const apply = this.apply; this.close(false); apply?.(); }
    onTapCancel(): void { this.close(); }
    close(notify = true): void {
        const dismiss = this.dismiss; this.apply = null; this.dismiss = null;
        if (this.liftedBoard && isValid(this.liftedBoard, true)) this.liftedBoard.hideLineClueHighlight();
        this.liftedBoard = null;
        if (this.hiddenTracks && isValid(this.hiddenTracks.board, true))
            this.hiddenTracks.board.setHintTracksHidden(this.hiddenTracks.cells, false);
        this.hiddenTracks = null;
        for (const item of this.lifted.sort((a, b) => a.index - b.index)) {
            if (!isValid(item.node, true)) continue;
            if (!isValid(item.parent, true)) continue;
            item.node.setParent(item.parent); item.node.setPosition(item.position); item.node.setScale(item.scale);
            item.node.setSiblingIndex(item.index);
        }
        this.lifted = [];
        if (this.layer && isValid(this.layer, true)) this.layer.destroy();
        this.layer = null;
        this.setApplyVisible(false);
        if (this.dimNode && isValid(this.dimNode, true)) this.dimNode.active = false;
        if (this.content && isValid(this.content, true)) this.content.active = false;
        if (notify) dismiss?.();
    }
    onDisable(): void { this.close(); }
    onDestroy(): void { this.close(); }
}
