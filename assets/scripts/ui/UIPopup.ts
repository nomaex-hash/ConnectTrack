import { _decorator, BlockInputEvents, Component, Node, UITransform, view } from 'cc';
import { PopupController } from './PopupController';
import { PopupAnimation } from './PopupAnimation';

const { ccclass, property } = _decorator;


const BLOCKER_OVERSIZE = 1.5;


@ccclass('UIPopup')
export abstract class UIPopup<TData = void> extends Component {
    @property({
        type: Node,
        tooltip:
            'Icon LOADING — gắn node có component IconLoading2 (tự xoay qua schedule(), xem ' +
            'assets/scripts/animation/iconLoading.ts — CÙNG pattern với HomeTabGroupManager.loadingIcon) ' +
            '— TỰ hiện ngay lúc popup show(), TỰ tắt khi subclass gọi hideLoading() (báo đã tải xong ' +
            'dữ liệu). Để TRỐNG thì bỏ qua hẳn tính năng này, không crash. Popup KHÔNG có tải bất ' +
            'đồng bộ gì (onShow() có sẵn data ngay) thì gọi hideLoading() NGAY ĐẦU onShow() để tắt ' +
            'luôn, tránh xoay mãi không dừng.',
    })
    loadingIcon: Node | null = null;

    private closeCallback: (() => void) | null = null;

    protected popups: PopupController | null = null;

    private animation: PopupAnimation | null = null;
    private inputBlocker: Node | null = null;
    private closing = false;


    attachPopups(controller: PopupController): void {
        this.popups = controller;
    }


    protected abstract onShow(data: TData): void;


    protected onHide(): void {

    }


    show(data: TData, onClosed: () => void): void {
        this.closeCallback = onClosed;
        this.closing = false;

        this.ensureInputBlocker();
        this.node.active = true;
        // Mặc định LUÔN hiện icon loading ngay khi popup vừa show() — subclass tự gọi
        // hideLoading() (trong onShow() hoặc SAU KHI tải/animation xong) khi đã sẵn sàng. Popup nào
        // không có gì phải đợi thì chỉ cần gọi hideLoading() ngay đầu onShow() của nó.
        this.showLoading();
        this.onShow(data);


        this.resolveAnimation()?.playEnter();
    }

    /** Hiện loadingIcon (nếu có gán) — chỉ cần bật node.active, chính component IconLoading2 trên
     * node đó tự lo xoay qua onEnable()/schedule() (xem iconLoading.ts), KHÔNG cần tween thủ công
     * ở đây. Tự gọi ngay lúc show(); subclass gọi lại TAY nếu cần hiện lại loading giữa chừng. */
    protected showLoading(): void {
        // LOG TẠM ĐỂ DEBUG — xoá sau khi xác định được nguyên nhân thật.
        console.log('[DEBUG UIPopup]', this.constructor.name, 'showLoading() lúc', performance.now().toFixed(0), 'loadingIcon=', !!this.loadingIcon);
        if (this.loadingIcon) this.loadingIcon.active = true;
    }

    /** Tắt hẳn loadingIcon (nếu có gán) — node.active=false tự kích IconLoading2.onDisable() dừng
     * xoay. Subclass gọi khi dữ liệu/animation đã sẵn sàng để hiện popup bình thường. An toàn gọi
     * nhiều lần / gọi khi chưa từng showLoading(). */
    protected hideLoading(): void {
        // LOG TẠM ĐỂ DEBUG — xoá sau khi xác định được nguyên nhân thật.
        console.log('[DEBUG UIPopup]', this.constructor.name, 'hideLoading() lúc', performance.now().toFixed(0), new Error().stack);
        if (this.loadingIcon) this.loadingIcon.active = false;
    }

   
    protected requestClose(): void {
        if (this.closing) return;

        const animation = this.resolveAnimation();
        if (!animation) {
            this.finishClose();
            return;
        }

        this.closing = true;
        animation.playExit(() => {
            this.closing = false;
            this.finishClose();
        });
    }

   
    forceClose(): void {
        this.closing = false;
        this.resolveAnimation()?.stopAndReset();
        this.finishClose();
    }

    private finishClose(): void {
        // Phòng hờ: popup bị đóng (kể cả forceClose) NGAY GIỮA LÚC vẫn còn "loading" (subclass
        // chưa kịp gọi hideLoading()) — tắt hẳn icon, tránh IconLoading2 tiếp tục schedule() xoay
        // trên 1 node đã ẩn.
        this.hideLoading();
        this.onHide();
        this.node.active = false;

        const callback = this.closeCallback;
        this.closeCallback = null;
        if (callback) callback();
    }

 
    private ensureInputBlocker(): void {
        if (this.inputBlocker?.isValid) return;

        const node = new Node('PopupInputBlocker');
        node.layer = this.node.layer;

        const size = view.getVisibleSize();
        node.addComponent(UITransform).setContentSize(
            size.width * BLOCKER_OVERSIZE,
            size.height * BLOCKER_OVERSIZE,
        );
        node.addComponent(BlockInputEvents);

        node.setParent(this.node);
        node.setPosition(0, 0, 0);
        node.setSiblingIndex(0); 

        this.inputBlocker = node;
    }

    private resolveAnimation(): PopupAnimation | null {
        if (!this.animation || !this.animation.isValid) {
            this.animation = this.getComponent(PopupAnimation);
        }
        return this.animation;
    }
}
