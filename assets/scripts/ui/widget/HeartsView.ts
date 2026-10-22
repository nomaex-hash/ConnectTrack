import { _decorator, Animation, Component, instantiate, Node, Prefab, UITransform, Vec2, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Hiển thị N tim mạng (xác nhận từ user, kiến trúc mới): mỗi ô trong `emptyHeartSlots` là 1 node
 * TIM RỖNG đã author SẴN trong Editor (xếp bằng Layout, KHÔNG phải code tự instantiate) — code chỉ
 * instantiate `heartAnimPrefab` (đã có sẵn cả trạng thái ĐẦY lúc idle lẫn hiệu ứng VỠ) ĐÈ LÊN từng
 * ô đó, bật active khi "còn mạng" (che tim rỗng bên dưới, hiện tim đầy) và tắt active SAU KHI clip
 * vỡ chạy xong (lộ tim rỗng có sẵn ra). Không còn tự tạo node tim nào — chỉ dùng slot có sẵn.
 */
@ccclass('HeartsView')
export class HeartsView extends Component {
    @property({
        type: [Node],
        tooltip:
            'ĐÚNG N node "tim rỗng" ĐÃ CÓ SẴN trong Editor (vd Heart, Heart-001, Heart-002...), xếp ' +
            'bằng Layout — đây là các Ô CỐ ĐỊNH (xác nhận từ user), không phải prefab code tự tạo. ' +
            'Thứ tự trong mảng = thứ tự mất mạng (trái→phải).',
    })
    emptyHeartSlots: Node[] = [];

    @property({
        type: Prefab,
        tooltip:
            'Prefab "tim anim" (đã có sẵn 2 trạng thái: ĐẦY lúc idle, VỠ lúc chạy breakClipName) — ' +
            'code tự instantiate 1 bản ĐÈ LÊN mỗi ô tim rỗng ở trên (con của chính ô đó, vị trí ' +
            '0,0). Mặc định ACTIVE khi còn mạng (che tim rỗng, hiện "đầy"); TẮT active sau khi chạy ' +
            'xong breakClipName, lộ tim rỗng bên dưới ra.',
    })
    heartAnimPrefab: Prefab | null = null;

    @property({ tooltip: 'Tên clip Animation "vỡ" chạy trên heartAnimPrefab khi 1 tim bị mất. Để trống thì tắt overlay NGAY, không hoạt ảnh.' })
    breakClipName = '';

    @property({
        tooltip:
            'Overlay "tim anim" LUÔN tự co giãn theo đúng kích thước (UITransform.contentSize) của ' +
            'ô "tim rỗng" nó đè lên (xác nhận từ user) — KHÔNG dùng kích thước gốc của prefab nữa, ' +
            'tránh lệch nếu 2 bên khác size. Property này CỘNG THÊM (px) vào kích thước đó nếu ' +
            'overlay cần to/nhỏ hơn ô rỗng 1 chút — để (0,0) thì khớp y hệt, không chỉnh gì.',
    })
    heartAnimSizeOffset: Vec2 = new Vec2(0, 0);

    private readonly overlays: (Node | null)[] = [];
    /** true từ sau LẦN set() ĐẦU TIÊN — trước đó không có khái niệm "vừa chuyển trạng thái" nào cả,
     * chỉ đồng bộ tĩnh theo remaining/max hiện tại (xem nhánh !heartStateInitialized bên dưới). */
    private heartStateInitialized = false;
    /** BUG đã sửa (báo lỗi của user: "đặt sai, anim tim vỡ đang chạy mà thao tác tiếp thì anim lặp
     * lại liên tục từ đầu"): trước đây wasFull đọc TRỰC TIẾP overlay.active — nhưng overlay.active
     * vẫn = true SUỐT lúc clip vỡ đang chạy (chỉ về false ở callback FINISHED của playBreak()), nên
     * MỌI lần set() gọi lại trong lúc đó (vd do refreshConnectTracksBoard() chạy lại vì bất kỳ thao
     * tác nào khác của người chơi, không chỉ riêng mistake mới) đều hiểu lầm "tim NÀY lại vừa vỡ
     * lần nữa", gọi playBreak() đè lên animation đang chạy dở, restart từ đầu — lặp vô hạn tới khi
     * người chơi ngừng thao tác đủ lâu cho animation chạy hết 1 lần trọn vẹn không bị interrupt.
     * Theo dõi RIÊNG bằng Set này (chỉ đổi ở ĐÚNG lúc phát hiện chuyển full->mất hoặc mất->full),
     * độc lập với overlay.active — set() gọi lại khi KHÔNG có gì đổi (index vẫn đang breaking dở)
     * giờ không chạm gì tới overlay/animation đang chạy nữa. */
    private readonly lostIndices = new Set<number>();

    /** remaining/max: index < remaining = "còn mạng" (overlay ACTIVE, hiện tim đầy); index >= remaining
     * = "đã mất" (overlay tắt, lộ tim rỗng). Tim nào vừa chuyển từ còn→mất (so với lần set() trước)
     * sẽ chạy breakClipName thay vì tắt tức thì — áp dụng cho cả mistake lúc chơi thật (xác nhận từ
     * user: không chỉ riêng popup thua). */
    set(remaining: number, max: number): void {
        for (let i = 0; i < this.emptyHeartSlots.length; i++) {
            const slot = this.emptyHeartSlots[i];
            if (!slot) continue;
            slot.active = i < max;
            if (i >= max) continue;
            const nowFull = i < remaining;

            if (!this.heartStateInitialized) {
                // Lần đầu tiên: chỉ đồng bộ tĩnh, không có "chuyển trạng thái" nào để chạy hoạt ảnh.
                if (nowFull) this.lostIndices.delete(i); else this.lostIndices.add(i);
                const overlay = this.ensureOverlay(i);
                if (overlay) overlay.active = nowFull;
                continue;
            }

            const wasFull = !this.lostIndices.has(i);
            if (wasFull && !nowFull) {
                this.lostIndices.add(i);
                this.playBreak(i); // Overlay tự tắt SAU KHI chạy xong clip vỡ (xem playBreak).
            } else if (!wasFull && nowFull) {
                this.lostIndices.delete(i);
                // BUG đã sửa (báo lỗi của user — "bấm chơi lại, tim vẫn chưa được reset"): tim HỒI
                // PHỤC sau khi đã từng vỡ (restart/revive) — overlay cũ còn ĐỨNG ở frame CUỐI clip
                // vỡ (Animation.stop() không tự đưa playhead về đầu), chỉ bật lại active=true là
                // KHÔNG đủ, vẫn hiện hình vỡ dở/trong suốt thay vì tim đầy. Dựng overlay MỚI TINH
                // (pristine, y hệt lúc ensureOverlay() tạo lần đầu, chưa từng play()) để chắc chắn
                // về đúng hình "đầy" tĩnh.
                this.recreateOverlay(i);
            }
            // else: không đổi gì so với lần set() trước (kể cả đang breaking dở) — KHÔNG đụng tới
            // overlay/animation, để animation đang chạy (nếu có) tự chạy tiếp đến hết.
        }
        this.heartStateInitialized = true;
    }

    /** Tạo (lười, 1 lần) bản overlay cho ô `index`, làm con của ĐÚNG ô tim rỗng đó, vị trí (0,0) —
     * tự động đè đúng chỗ bất kể Layout sắp ô đó ở đâu. */
    private ensureOverlay(index: number): Node | null {
        const existing = this.overlays[index];
        if (existing) return existing;
        const slot = this.emptyHeartSlots[index];
        if (!slot || !this.heartAnimPrefab) return null;
        const overlay = instantiate(this.heartAnimPrefab);
        overlay.parent = slot;
        overlay.setPosition(0, 0, 0);
        // Tự co giãn theo đúng kích thước ô "tim rỗng" (xác nhận từ user) — BẰNG SCALE, không phải
        // setContentSize() trên node gốc: node gốc của heartAnimPrefab chỉ là container RỖNG
        // (UITransform + Animation), toàn bộ hình vẽ thật nằm ở các node CON (Heart/heartlefft/
        // heartRight, mỗi node có UITransform/Sprite RIÊNG) — đổi contentSize của node gốc không hề
        // ảnh hưởng gì tới kích thước hiển thị của chúng. Scale thì luôn cascade xuống mọi con, bất
        // kể cấu trúc bên trong prefab ra sao. heartAnimSizeOffset cộng thêm (px) vào kích thước ô
        // rỗng TRƯỚC khi tính tỉ lệ, nếu cần overlay to/nhỏ hơn ô rỗng 1 chút.
        const slotSize = slot.getComponent(UITransform)?.contentSize;
        const overlayTransform = overlay.getComponent(UITransform);
        const naturalSize = overlayTransform?.contentSize;
        if (slotSize && naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
            const scaleX = (slotSize.width + this.heartAnimSizeOffset.x) / naturalSize.width;
            const scaleY = (slotSize.height + this.heartAnimSizeOffset.y) / naturalSize.height;
            overlay.setScale(scaleX, scaleY, 1);
        }
        // Dừng ngay nếu Animation tự playOnLoad — mặc định phải đứng TĨNH (hiện "đầy"), chỉ thật
        // sự CHẠY khi playBreak() gọi anim.play() lúc có mistake (xác nhận từ user).
        overlay.getComponent(Animation)?.stop();
        this.overlays[index] = overlay;
        return overlay;
    }

    /** Phá huỷ overlay CŨ (nếu có, đã từng vỡ nên animation còn kẹt ở frame cuối) rồi dựng lại MỚI
     * TINH qua ensureOverlay() — bảo đảm về đúng trạng thái "đầy" tĩnh, bật active=true. */
    private recreateOverlay(index: number): void {
        const existing = this.overlays[index];
        if (existing?.isValid) existing.destroy();
        this.overlays[index] = null;
        const overlay = this.ensureOverlay(index);
        if (overlay) overlay.active = true;
    }

    /** Phát breakClipName trên overlay của ô `index` rồi TẮT overlay khi chạy xong — lộ tim rỗng có
     * sẵn bên dưới ra. Không có Animation/breakClipName thì tắt NGAY, không hoạt ảnh (an toàn nếu
     * Editor chưa kịp gán). */
    private playBreak(index: number): void {
        const overlay = this.ensureOverlay(index);
        if (!overlay) return;
        overlay.active = true;
        const anim = overlay.getComponent(Animation);
        if (anim && this.breakClipName) {
            anim.once(Animation.EventType.FINISHED, () => { if (overlay.isValid) overlay.active = false; });
            anim.play(this.breakClipName);
        } else {
            overlay.active = false;
        }
    }

    /** LOSE POPUP (xác nhận từ user): hiện ĐẦY cả `count` tim trước, rồi phát breakClipName LẦN
     * LƯỢT cho từng tim, mỗi tim cách nhau `staggerSeconds` — dùng khi mở popup thua (độc lập với
     * set(), không liên quan gì tới mistake thật đang đếm). */
    playAllBreaksSequentially(count: number, staggerSeconds: number): void {
        for (let i = 0; i < count; i++) {
            const overlay = this.ensureOverlay(i);
            if (overlay) overlay.active = true;
        }
        // BUG đã sửa (báo lỗi của user): phải vỡ từ tim NGOÀI CÙNG BÊN PHẢI (index count-1) trước,
        // lần lượt về tim bên trái (index 0) — trước đây chạy ngược (trái→phải).
        for (let i = count - 1; i >= 0; i--) {
            const order = count - 1 - i;
            this.scheduleOnce(() => this.playBreak(i), (order + 1) * staggerSeconds);
        }
    }

    /** Prefab tim anim — dùng làm icon bay (GameplayScreen hiệu ứng tim bay lúc thắng), xác nhận từ
     * user: KHÔNG dùng SpriteFrame tĩnh riêng, mà instantiate thẳng chính prefab này (ở trạng thái
     * TĨNH, không play) làm icon bay — y hệt hình đã thấy trong các ô tim. */
    get animPrefab(): Prefab | null {
        return this.heartAnimPrefab;
    }

    /**
     * "Nhấc" 1 tim còn mạng để bay đi: lấy overlay ĐANG ACTIVE có index CAO NHẤT (đúng thứ tự mất
     * mạng — tim mất trước luôn ở bên phải), tắt overlay đó ngay (không còn ở ô mistake nữa) và trả
     * về world position của nó làm điểm xuất phát. Null nếu không còn tim nào đang đầy.
     */
    takeFullHeart(): Vec3 | null {
        for (let i = this.overlays.length - 1; i >= 0; i--) {
            const overlay = this.overlays[i];
            if (!overlay || !overlay.isValid || !overlay.active) continue;
            const position = overlay.getWorldPosition();
            overlay.active = false;
            // Đồng bộ lostIndices (xem set()) — nếu không, lần set() kế tiếp (level mới, remaining
            // đầy trở lại) sẽ thấy wasFull/nowFull đều "true" (không phát hiện ra thay đổi) và bỏ
            // qua, khiến tim vừa "bay đi" này không được recreateOverlay() dựng lại tim đầy.
            this.lostIndices.add(i);
            return position;
        }
        return null;
    }
}
