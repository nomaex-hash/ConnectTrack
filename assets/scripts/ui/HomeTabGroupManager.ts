import { _decorator, Component, instantiate, Node, Tween, UITransform, Vec3, tween, view } from 'cc';
import { ItemTabHome } from './ItemTabHome';
import { BaseTabGroupManager } from '../home/BaseTabGroupManager';
import { TAB_TYPE } from '../core/TabType';
import { ResourceManager } from '../manager/ResourceManager';

const { ccclass, property } = _decorator;

/**
 * Thanh bottom bar màn Home — carousel ĐẨY: 3 trang (Shop/Home/Leaderboard) xếp cạnh nhau
 * theo trục X đúng thứ tự arrItemTabs, contentGroup tween trượt CẢ HÀNG khi đổi tab. Bấm Shop
 * (bên trái Home): Shop trượt vào từ trái, ĐẨY Home sang phải. Bấm Leaderboard (bên phải
 * Home): Leaderboard trượt vào từ phải, ĐẨY Home sang trái. Home KHÔNG có xử lý gì đặc biệt —
 * là 1 trang carousel bình thường như Shop/Leaderboard.
 *
 * Background của Home (ảnh nền) KHÔNG nằm trong contentGroup — tách riêng thành 1 lớp cố định
 * (sibling của contentGroup, đứng TRƯỚC nó trong Hierarchy) để luôn đứng yên dù Home bị đẩy đi.
 *
 * LAZY-LOAD (mirror MConfigResourceUtils.loadPrefabUI_Bundle, dự án tham khảo MagicSort): mỗi
 * slot trong arrPageSlots là 1 Node RỖNG, xếp vị trí theo pageWidth. Nếu arrPagePrefabPaths[i]
 * có giá trị, trang đó được tải + instantiate từ Bundle (lazyBundleName) khi bấm tab lần ĐẦU
 * TIÊN, sau đó cache lại. Để trống path ("") cho slot Home — đã có sẵn trang thật làm con.
 *
 * 2 pha rõ rệt: setShow() gọi TRƯỚC khi trượt (chỉ bật node), showGroup() gọi SAU khi trượt
 * xong (mới fetch/dựng dữ liệu) — tránh dựng nội dung nặng trong lúc đang chạy animation.
 *
 * arrItemTabs[i]/arrPageSlots[i]/arrPagePrefabPaths[i] PHẢI cùng thứ tự trong Editor (ghép
 * theo VỊ TRÍ).
 */
@ccclass('HomeTabGroupManager')
export class HomeTabGroupManager extends Component {
    @property({ type: [ItemTabHome], tooltip: 'Đúng 3 phần tử: nút Shop, Home, Leaderboard.' })
    arrItemTabs: ItemTabHome[] = [];

    @property({
        type: [Node],
        tooltip:
            'Đúng 3 phần tử, CÙNG THỨ TỰ với arrItemTabs: node cha RỖNG của từng trang. Home nên có sẵn 1 trang thật làm con; Shop/Leaderboard để trống node, sẽ lazy-load prefab vào đây.',
    })
    arrPageSlots: Node[] = [];

    @property({
        type: [String],
        tooltip:
            'Đường dẫn prefab trong Bundle (KHÔNG kèm .prefab) để lazy-load cho từng slot — CÙNG THỨ TỰ arrPageSlots. Để trống ("") cho slot Home (đã có sẵn trang, không lazy-load).',
    })
    arrPagePrefabPaths: string[] = [];

    @property({ tooltip: 'Tên Bundle chứa các prefab lazy-load (đánh dấu qua Editor: chọn thư mục Assets → tick Bundle).' })
    lazyBundleName = 'home-tabs';

    @property({ type: Node, tooltip: 'Node cha chứa arrPageSlots, xếp cạnh nhau theo trục X — bị trượt khi đổi tab.' })
    contentGroup: Node | null = null;

    @property({ type: Node, tooltip: 'Node chặn input trong lúc đang trượt hoặc đang lazy-load (tuỳ chọn).' })
    lockGroup: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Icon xoay (gắn component IconLoading2) — chỉ hiện trong lúc lazy-load Bundle lần ĐẦU ' +
            'cho Shop/Leaderboard, thay vì hiện thẳng trang trống gây khựng. Ẩn ngay khi tải xong ' +
            'hoặc lỗi. Không hiện khi chuyển sang trang đã cache (tức thời, không cần loading).',
    })
    loadingIcon: Node | null = null;

    @property({
        tooltip:
            'Bề rộng 1 trang (px) lúc thiết kế — CHỈ dùng làm giá trị dự phòng nếu không lấy được view. ' +
            'Lúc chạy code tự tính lại theo kích thước MÀN HÌNH THẬT (xem onLoad) để đẩy trang cũ ra hẳn ' +
            'khỏi vùng nhìn thấy trên MỌI tỉ lệ màn hình, không riêng 720x1280.',
    })
    pageWidth = 720;

    @property({ tooltip: 'Thời gian trượt khi đổi tab (giây).' })
    slideSeconds = 0.3;

    @property({ tooltip: 'Tab mặc định khi mở màn Home.' })
    defaultTab: TAB_TYPE = TAB_TYPE.HOME;

    private currIndex = -1;
    private activeTween: Tween<Node> | null = null;
    private readonly pages: (BaseTabGroupManager | null)[] = [];
    private readonly loadingSlots: Set<number> = new Set();

    protected onLoad(): void {
        if (this.loadingIcon) this.loadingIcon.active = false;

        for (let i = 0; i < this.arrItemTabs.length; i++) {
            this.arrItemTabs[i].indexTab = i;
            this.arrItemTabs[i].setOnTap(this.setTouchTab);
        }

        // Kích thước NỘI DUNG (contentGroup + từng slot) VÀ khoảng cách đẩy giữa các trang đều
        // co giãn theo kích thước MÀN HÌNH THẬT lúc chạy (view.getVisibleSize()) — lấy max với
        // kích thước thiết kế (720x1280) để không nhỏ hơn khi màn hình hẹp hơn thiết kế.
        const designSize = view.getDesignResolutionSize();
        const visibleSize = view.getVisibleSize();
        const contentWidth = Math.max(designSize.width, visibleSize.width);
        const contentHeight = Math.max(designSize.height, visibleSize.height);
        this.pageWidth = contentWidth;

        this.contentGroup?.getComponent(UITransform)?.setContentSize(contentWidth, contentHeight);

        for (let i = 0; i < this.arrPageSlots.length; i++) {
            const slot = this.arrPageSlots[i];
            slot.setPosition(i * this.pageWidth, 0, 0);
            slot.getComponent(UITransform)?.setContentSize(contentWidth, contentHeight);

            const existing = slot.children[0]?.getComponent(BaseTabGroupManager) ?? null;
            if (existing) existing.node.active = false;
            this.pages[i] = existing;
        }
    }

    protected start(): void {
        const defaultIndex = this.arrItemTabs.findIndex((tab) => tab.tabType === this.defaultTab);
        this.currIndex = defaultIndex >= 0 ? defaultIndex : 0;

        this.updateTabButtons();
        this.contentGroup?.setPosition(-this.currIndex * this.pageWidth, this.contentGroup.position.y, 0);

        const page = this.pages[this.currIndex];
        page?.setShow();
        page?.showGroup();
    }

    private setTouchTab = (indexTab: number): void => {
        if (indexTab < 0 || indexTab >= this.arrItemTabs.length || indexTab === this.currIndex) return;
        this.goToIndex(indexTab);
    };

    /** Cho phép nơi KHÁC ngoài chính thanh tab bar (ví dụ 1 nút tắt đặt trên nội dung trang Home)
     * chuyển sang 1 tab cụ thể — dùng lại NGUYÊN VẸN logic trượt/lazy-load của setTouchTab(),
     * không viết lại. Không làm gì nếu tabType không khớp phần tử nào trong arrItemTabs. */
    goToTab(tabType: TAB_TYPE): void {
        const index = this.arrItemTabs.findIndex((tab) => tab.tabType === tabType);
        if (index < 0) return;
        this.setTouchTab(index);
    }

    private goToIndex(index: number): void {
        this.pages[this.currIndex]?.setHide();

        this.currIndex = index;
        this.updateTabButtons();
        // Trang có thể đã bị ẩn hẳn (node.active=false) nếu lần tải trước hoàn tất SAU KHI người
        // chơi đã rời tab này (xem activatePage) — bật lại node gốc trước khi setShow(), nếu không
        // trang sẽ bị trống vĩnh viễn dù đã có trong cache.
        const targetPage = this.pages[index];
        if (targetPage) targetPage.node.active = true;
        targetPage?.setShow();

        if (this.lockGroup) this.lockGroup.active = true;

        this.activeTween?.stop();
        if (!this.contentGroup) return;

        const targetX = -index * this.pageWidth;
        this.activeTween = tween(this.contentGroup)
            .to(
                this.slideSeconds,
                { position: new Vec3(targetX, this.contentGroup.position.y, 0) },
                { easing: 'quadOut' },
            )
            .call(() => this.activatePage(index))
            .start();
    }

    /** Hiện trang tại slot [index] — dựng ngay nếu đã cache, lazy-load từ Bundle nếu chưa. */
    private activatePage(index: number): void {
        const cached = this.pages[index];
        if (cached) {
            cached.showGroup();
            if (this.lockGroup) this.lockGroup.active = false;
            return;
        }

        const path = this.arrPagePrefabPaths[index];
        if (!path) {
            if (this.lockGroup) this.lockGroup.active = false;
            return;
        }
        if (this.loadingSlots.has(index)) return;

        this.loadingSlots.add(index);
        if (this.lockGroup) this.lockGroup.active = true;
        if (this.loadingIcon) this.loadingIcon.active = true;

        ResourceManager.instance
            .loadPrefabFromBundle(this.lazyBundleName, path)
            .then((prefab) => {
                this.loadingSlots.delete(index);

                const slot = this.arrPageSlots[index];
                if (!slot?.isValid) return;

                const node = instantiate(prefab);
                node.setParent(slot);
                node.setPosition(0, 0, 0);

                const page = node.getComponent(BaseTabGroupManager);
                if (!page) {
                    console.warn(`[HomeTabGroupManager] Prefab '${path}' thiếu component BaseTabGroupManager.`);
                    if (this.lockGroup) this.lockGroup.active = false;
                    if (this.loadingIcon) this.loadingIcon.active = false;
                    return;
                }
                this.pages[index] = page;

                // Người chơi có thể đã bấm sang tab khác trong lúc chờ tải — chỉ hiện nếu vẫn đang đứng ở tab này.
                // Node vừa instantiate() mặc định active=true theo prefab, KHÔNG tự ẩn — nếu không
                // đứng ở tab này nữa phải ẩn hẳn ngay, nếu không nó đè hình lên tab đang hiện
                // (đây là lỗi tab Shop/Leaderboard "rò rỉ" một nửa màn hình khi bấm đổi tab quá nhanh).
                if (this.currIndex === index) {
                    page.setShow();
                    page.showGroup();
                } else {
                    node.active = false;
                }
                if (this.lockGroup) this.lockGroup.active = false;
                if (this.loadingIcon) this.loadingIcon.active = false;
            })
            .catch((error: unknown) => {
                this.loadingSlots.delete(index);
                console.warn(`[HomeTabGroupManager] Lazy-load prefab '${path}' thất bại:`, error);
                if (this.lockGroup) this.lockGroup.active = false;
                if (this.loadingIcon) this.loadingIcon.active = false;
            });
    }

    /**
     * Chỉ báo cho từng nút biết CÓ được chọn hay không — mỗi ItemTabHome tự đổi bề rộng của
     * chính nó (selectedWidth/unselectedWidth). Vị trí X + khoảng cách + vách "Vach" xen giữa
     * do component Layout (Horizontal) gắn trên Container tự xếp lại — không tính tay trong
     * code nữa.
     */
    private updateTabButtons(): void {
        for (let i = 0; i < this.arrItemTabs.length; i++) {
            this.arrItemTabs[i].showTab(i === this.currIndex);
        }
    }
}
