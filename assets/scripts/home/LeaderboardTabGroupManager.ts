// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { BaseTabGroupManager } from './BaseTabGroupManager';
import { LeaderboardManager } from '../leaderboard/LeaderboardManager';
import { LeaderboardGroupWeek } from '../leaderboard/LeaderboardGroupWeek';
import { CountDownTimeEvent } from '../common/CountDownTimeEvent';
import { GameManager } from '../manager/GameManager';
import { UIManager } from '../manager/UIManager';
const { ccclass, property } = _decorator;

/**
 * KHÔNG còn tab Global — chỉ còn hiện Weekly. Đã bỏ hẳn khỏi code: arrItemTabLeaderboards (nút
 * chuyển tab), currTab, setTouchTabLeaderboard/setUpdateTab (cơ chế chuyển tab),
 * leaderboardGroupWorld (board Global) — không còn đường nào trong code có thể kích hoạt Global
 * nữa, kể cả nếu prefab còn giữ lại node/component đó (đơn giản là không ai gọi tới).
 */
@ccclass('LeaderboardTabGroupManager')
export class LeaderboardTabGroupManager extends BaseTabGroupManager {
    @property(LeaderboardGroupWeek)
    leaderboardGroupWeek: LeaderboardGroupWeek = null;

    @property(CountDownTimeEvent)
    countDownTimeNextWeek: CountDownTimeEvent = null!;

    @property({
        type: [Node],
        tooltip:
            'Các node PHẢI ẩn hẳn (active=false) cho tới khi avatar/frame + rank list tải xong và ' +
            'ổn định (xác nhận từ user: "điều kiện để mở leaderboard là khi avatar và frame đã tải ' +
            'xong và ổn định rồi thì mới mở") — ví dụ cụm tiêu đề "Xếp hạng"/đồng hồ đếm ngược/nút ' +
            'đóng (node "TOP"), banner "Đến nhận" (node "btnCollect"). KHÔNG gồm TOP3/ScrollView ' +
            '(đã tự ẩn/hiện đúng lúc bên trong LeaderboardGroupWeek) hay icon loading (luôn hiện ' +
            'suốt lúc chờ, KHÔNG được cho vào đây). Để trống thì bỏ qua, giữ hành vi cũ (hiện ngay).',
    })
    hideUntilLoaded: Node[] = [];

    protected onEnable(): void {
        super.onEnable();
        this.leaderboardGroupWeek?.resetGroup();
        this.showInfo();
    }

    /** "Icon loading phải hiện TRƯỚC khi mở [tab] Leaderboard, không phải mở xong mới hiện" (xác
     * nhận từ user) — setShow() chạy NGAY lúc bắt đầu chuyển tab, TRƯỚC khi HomeTabGroupManager
     * trượt nội dung vào (showGroup() — nơi thật sự fetch rank list/avatar — chỉ chạy SAU KHI trượt
     * xong, xem HomeTabGroupManager.goToIndex()/activatePage()). Bật nodeLoading ngay tại đây để
     * icon xoay SẴN suốt lúc trượt; ẩn hẳn hideUntilLoaded — "mở" (hiện ra) chỉ xảy ra SAU KHI
     * showLeaderboardGroup() báo đã tải xong và ổn định (xem whenReady()). */
    setShow(): void {
        super.setShow();
        if (this.leaderboardGroupWeek?.nodeLoading) this.leaderboardGroupWeek.nodeLoading.active = true;
        for (const node of this.hideUntilLoaded) if (node) node.active = false;
    }

    protected onDisable(): void {
        super.onDisable();
    }

    setHide(): void {
        super.setHide();
        this.leaderboardGroupWeek?.resetGroup();
    }

    showGroup(): void {
        super.showGroup();
        this.showLeaderboardGroup();
    }

    showLeaderboardGroup(){
        this.leaderboardGroupWeek?.resetGroup();
        if (this.leaderboardGroupWeek) {
            this.leaderboardGroupWeek.node.active = true;
            // BUG đã sửa (báo lỗi của user — "icon loading tắt quá sớm") — đăng ký qua onReady()
            // (callback ĐỒNG BỘ, chạy CÙNG lệnh với lúc nodeLoading tắt bên trong LeaderboardGroupWeek)
            // thay vì whenReady().then() (Promise, luôn trễ thêm ít nhất 1 microtask vì readyResolve()
            // được gọi TỪ BÊN TRONG 1 .then() khác) — đảm bảo hideUntilLoaded hiện ra ĐÚNG lúc
            // nodeLoading tắt, không sớm/muộn hơn dù chỉ 1 nhịp.
            // THỨ TỰ QUAN TRỌNG: gọi showGroup() TRƯỚC — nó tự reset readyCallbacks=[] ngay dòng
            // đầu tiên (đồng bộ) — rồi mới onReady() đăng ký SAU, nếu không đăng ký trước sẽ bị xoá
            // mất ngay khi showGroup() chạy tới dòng reset đó. An toàn vì phần ASYNC (nơi thật sự
            // gọi các callback đã đăng ký) chỉ chạy sau khi lệnh gọi đồng bộ này unwind xong hẳn.
            this.leaderboardGroupWeek.showGroup();
            this.leaderboardGroupWeek.onReady(() => {
                if (!this.isValid) return;
                for (const node of this.hideUntilLoaded) if (node) node.active = true;
            });
        }
    }

    /** Dùng bởi nơi BỌC tab này thành popup riêng (ví dụ LeaderboardPopup) để biết lúc nào avatar/
     * frame + rank list đã tải xong và ổn định — y hệt whenReady() của LeaderboardGroupWeek, chỉ
     * là passthrough tiện gọi từ bên ngoài component con.
     * @deprecated BUG đã sửa (báo lỗi của user — "icon loading vẫn tắt quá sớm", lặp lại dù đã sửa
     * đổ ở LeaderboardTabGroupManager): LeaderboardPopup (lối vào THẬT từ Main Menu, không còn qua
     * carousel HomeTabGroupManager nữa — xem doc của chính nó) vẫn gọi hàm NÀY (Promise, luôn trễ
     * ít nhất 1 microtask vì readyResolve() được gọi TỪ BÊN TRONG 1 .then() khác) để tắt loadingIcon
     * CỦA CHÍNH popup đó — dùng onLeaderboardReady() (callback đồng bộ) bên dưới thay vào đó. */
    whenLeaderboardReady(): Promise<void> {
        return this.leaderboardGroupWeek?.whenReady() ?? Promise.resolve();
    }

    /** Callback ĐỒNG BỘ — chạy CÙNG lệnh với lúc nodeLoading tắt bên trong LeaderboardGroupWeek,
     * không qua Promise (xem LeaderboardGroupWeek.onReady() để biết lý do). Gọi SAU showGroup()
     * (xem showLeaderboardGroup() ở trên, cùng lý do thứ tự). */
    onLeaderboardReady(callback: () => void): void {
        this.leaderboardGroupWeek?.onReady(callback);
    }

    showInfo(){
        if (!LeaderboardManager.instance || !this.countDownTimeNextWeek) return;
        let countDownTimeNextWeek:number = LeaderboardManager.instance.getTimeToNextWeek();
        this.countDownTimeNextWeek.initCountDownTime(countDownTimeNextWeek,()=>{
            // Đếm ngược chạm 0 NGAY LÚC người chơi đang đứng xem Leaderboard — giải đấu vừa hết
            // giờ đúng lúc này, hiện popup kết thúc/kích hoạt giải đấu NGAY TẠI ĐÂY (đè lên
            // Leaderboard đang mở) thay vì đợi họ rời màn rồi quay lại Home mới thấy.
            GameManager.instance?.checkPendingTournamentResult();
            UIManager.instance?.checkTournamentPopupForTesting();
            this.showInfo();
        });
    }

}


