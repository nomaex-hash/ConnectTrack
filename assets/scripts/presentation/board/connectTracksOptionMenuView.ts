import { _decorator, Component, Node, Tween, UIOpacity, tween } from 'cc';
import { TrackOptionKind, TrackOptionValidity } from './trackOptions';

const { ccclass, property } = _decorator;

/**
 * Track option menu (xác nhận từ user): cụm CỐ ĐỊNH gồm 7 option (6 hình dạng track + "track
 * preview"), hiện khi single-tap vào 1 ô TrackPreview/Track/Track ? trên board. Node gốc của
 * component này nằm ở màn Gameplay (KHÔNG phải trong Board.prefab) — tự định vị/di chuyển trong
 * Editor, component này không tự tính vị trí theo ô nào cả.
 *
 * 6 option hình dạng track (property bên dưới là node GỐC của option đó) cần node con "active"/
 * "inactive" — ĐÚNG như cấu trúc thật trong GameplayScreen.prefab (code tự getChildByName, giống
 * sleeper/rail của ConnectTracksCellView — không cần property riêng cho từng con):
 *   - "active"   : sprite thường + component Button (nhận tap) — bật khi option HỢP LỆ.
 *   - "inactive" : sprite XÁM, KHÔNG có Button — bật khi option KHÔNG hợp lệ. Vì "active" (nơi
 *                  gắn Button) bị tắt lúc này, option xám KHÔNG THỂ bấm được.
 *
 * Viền xanh đánh dấu "đây là trạng thái HIỆN TẠI của ô" (xác nhận từ user: chỉ hiện ở ĐÚNG 1
 * option đang trùng, tắt ở mọi option hợp lệ còn lại) lấy từ node con TÊN "Line" nằm LỒNG BÊN
 * TRONG chính node "active" đó (cấu trúc thật trong prefab — không phải 1 node "currentOutline"
 * riêng cùng cấp). Nếu sau này dựng thêm 1 node "currentOutline" cùng cấp active/inactive, code
 * vẫn ưu tiên dùng nó thay vì "Line" bên trong active.
 *
 * RIÊNG "track preview" (xác nhận từ user): LUÔN hợp lệ — bất kỳ Track/Track ?/TrackPreview nào
 * cũng đủ điều kiện quay về TrackPreview trống, không có trường hợp bị khoá — nên node của nó
 * KHÔNG CÓ trạng thái "inactive", chỉ cần node con "active" (chứa "Line" bên trong nếu có).
 *
 * Pure presentation: không tự quyết định gameplay gì — chỉ hiện/ẩn + báo lại qua
 * setOptionSelectedHandler khi người chơi bấm 1 option hợp lệ, GameplayScreen (chủ của
 * connectTracksSession) mới là nơi dispatch command thật.
 */
@ccclass('ConnectTracksOptionMenuView')
export class ConnectTracksOptionMenuView extends Component {
    @property({
        type: Node,
        tooltip:
            'Track option: "track preview" — xoá hết connection của ô, về lại TrackPreview trống. ' +
            'LUÔN hợp lệ (mọi Track/Track ?/TrackPreview đều quay về được) — chỉ cần node con ' +
            '"active" (+ "currentOutline" tuỳ chọn), KHÔNG cần "inactive".',
    })
    private optionTrackPreview: Node | null = null;

    @property({ type: Node, tooltip: 'Track option: đường thẳng NGANG (Left+Right). Cần node con active/inactive (+ currentOutline tuỳ chọn).' })
    private optionStraightHorizontal: Node | null = null;

    @property({ type: Node, tooltip: 'Track option: đường thẳng DỌC (Up+Down). Cần node con active/inactive (+ currentOutline tuỳ chọn).' })
    private optionStraightVertical: Node | null = null;

    @property({ type: Node, tooltip: 'Track option: đường cong góc TRÊN-TRÁI (Up+Left). Cần node con active/inactive (+ currentOutline tuỳ chọn).' })
    private optionCurveTopLeft: Node | null = null;

    @property({ type: Node, tooltip: 'Track option: đường cong góc TRÊN-PHẢI (Up+Right). Cần node con active/inactive (+ currentOutline tuỳ chọn).' })
    private optionCurveTopRight: Node | null = null;

    @property({ type: Node, tooltip: 'Track option: đường cong góc DƯỚI-TRÁI (Down+Left). Cần node con active/inactive (+ currentOutline tuỳ chọn).' })
    private optionCurveBottomLeft: Node | null = null;

    @property({ type: Node, tooltip: 'Track option: đường cong góc DƯỚI-PHẢI (Down+Right). Cần node con active/inactive (+ currentOutline tuỳ chọn).' })
    private optionCurveBottomRight: Node | null = null;

    @property({ tooltip: 'Thời gian (giây) fade opacity khi cả cụm menu hiện/ẩn.' })
    private fadeSeconds = 0.18;

    private visible = false;
    private optionSelectedHandler: ((kind: TrackOptionKind) => void) | null = null;

    onLoad(): void {
        // An inactive prefab loads for the first time inside setVisible(true).
        // Preserve that pending show instead of deactivating the node again.
        if (!this.visible) this.hideInstant();
    }

    onDestroy(): void {
        this.optionSelectedHandler = null;
    }

    /** Gọi lại mỗi khi người chơi bấm 1 option đang HỢP LỆ (kể cả option đang là current — vẫn bấm
     * được, xác nhận từ user). GameplayScreen gán handler này để dispatch command thật. */
    setOptionSelectedHandler(handler: ((kind: TrackOptionKind) => void) | null): void {
        this.optionSelectedHandler = handler;
    }

    /** Đổ dữ liệu hợp lệ cho cả 7 option rồi fade cụm menu hiện lên (nếu đang ẩn). */
    show(validity: TrackOptionValidity): void {
        this.applyTrackPreviewOption(validity.current === 'trackPreview');
        this.applyOption(this.optionStraightHorizontal, 'straightHorizontal', validity.straightHorizontal, validity.current);
        this.applyOption(this.optionStraightVertical, 'straightVertical', validity.straightVertical, validity.current);
        this.applyOption(this.optionCurveTopLeft, 'curveTopLeft', validity.curveTopLeft, validity.current);
        this.applyOption(this.optionCurveTopRight, 'curveTopRight', validity.curveTopRight, validity.current);
        this.applyOption(this.optionCurveBottomLeft, 'curveBottomLeft', validity.curveBottomLeft, validity.current);
        this.applyOption(this.optionCurveBottomRight, 'curveBottomRight', validity.curveBottomRight, validity.current);
        this.setVisible(true);
    }

    /** Fade cụm menu ẩn đi (nếu đang hiện). */
    hide(): void {
        this.setVisible(false);
    }

    /** Tắt NGAY (không tween) — dùng khi đóng màn hoặc đổi level, tránh hiệu ứng ẩn chạy lố. */
    hideInstant(): void {
        this.visible = false;
        Tween.stopAllByTarget(this.node);
        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 0;
        }
        this.node.active = false;
    }

    private applyOption(node: Node | null, kind: TrackOptionKind, valid: boolean, current: TrackOptionKind | null): void {
        if (!node) return;
        const active = node.getChildByName('active');
        const inactive = node.getChildByName('inactive');
        if (active) active.active = valid;
        if (inactive) inactive.active = !valid;
        this.applyCurrentOutline(node, active, valid && kind === current);
    }

    /** "track preview" luôn hợp lệ (xác nhận từ user) — không có node "inactive" để bật/tắt, chỉ
     * cần bật "active" (luôn true) và viền "đang có" khi đang là trạng thái hiện tại của ô. */
    private applyTrackPreviewOption(isCurrent: boolean): void {
        const node = this.optionTrackPreview;
        if (!node) return;
        const active = node.getChildByName('active');
        if (active) active.active = true;
        this.applyCurrentOutline(node, active, isCurrent);
    }

    /**
     * Viền xanh đánh dấu "đang là trạng thái hiện tại của ô" (xác nhận từ user: chỉ 1 option, tắt
     * ở mọi option còn lại). Ưu tiên 1 node "currentOutline" cùng cấp active/inactive nếu có; nếu
     * không, dùng cấu trúc thật trong prefab — node con tên "Line" nằm LỒNG BÊN TRONG "active".
     */
    private applyCurrentOutline(optionNode: Node, active: Node | null, show: boolean): void {
        const currentOutline = optionNode.getChildByName('currentOutline');
        if (currentOutline) {
            currentOutline.active = show;
            return;
        }
        const line = active?.getChildByName('Line');
        if (line) {
            line.active = show;
        }
    }

    private setVisible(visible: boolean): void {
        if (visible === this.visible) {
            return;
        }
        this.visible = visible;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        if (visible) {
            this.node.active = true;
            opacity.opacity = 0;
            tween(opacity).to(this.fadeSeconds, { opacity: 255 }).start();
        } else {
            tween(opacity)
                .to(this.fadeSeconds, { opacity: 0 })
                .call(() => {
                    this.node.active = false;
                })
                .start();
        }
    }

    // Mỗi node "active" bên trong 1 option gắn component Button — Click Event của Button đó trỏ
    // Target vào NODE GỐC của component này (node đang gắn ConnectTracksOptionMenuView), Component
    // = ConnectTracksOptionMenuView, Handler = ĐÚNG 1 trong 7 method dưới đây tương ứng option đó.

    onTapTrackPreview(): void {
        this.optionSelectedHandler?.('trackPreview');
    }

    onTapStraightHorizontal(): void {
        this.optionSelectedHandler?.('straightHorizontal');
    }

    onTapStraightVertical(): void {
        this.optionSelectedHandler?.('straightVertical');
    }

    onTapCurveTopLeft(): void {
        this.optionSelectedHandler?.('curveTopLeft');
    }

    onTapCurveTopRight(): void {
        this.optionSelectedHandler?.('curveTopRight');
    }

    onTapCurveBottomLeft(): void {
        this.optionSelectedHandler?.('curveBottomLeft');
    }

    onTapCurveBottomRight(): void {
        this.optionSelectedHandler?.('curveBottomRight');
    }
}
