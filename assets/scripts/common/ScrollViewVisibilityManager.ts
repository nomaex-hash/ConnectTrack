// @ts-nocheck
import { _decorator, Component, Node, ScrollView, UITransform, Vec3 } from 'cc';
import { ItemBaseScrollView } from './ItemBaseScrollView';
const { ccclass, property } = _decorator;

@ccclass('ScrollViewVisibilityManager')
export class ScrollViewVisibilityManager extends Component {
      @property(ScrollView) scrollView: ScrollView = null!;
    /** nới biên để tránh pop-in (px) */
    @property buffer = 150;

    private viewportUT!: UITransform;
    private contentUT!: UITransform;
    private items: ItemBaseScrollView[] = [];
    private pending = false;

    protected onLoad(): void {
        this.viewportUT = this.scrollView.node.getComponent(UITransform)!;
        this.contentUT = this.scrollView.content.getComponent(UITransform)!;
        this.items = this.scrollView.content!.children
            .map(n => n.getComponent(ItemBaseScrollView))
            .filter(Boolean) as ItemBaseScrollView[];
    }

    protected onEnable(): void {
        this.scrollView.node.on('scrolling', this.requestUpdate, this);
        this.scrollView.node.on('scroll-ended', this.updateVisibility, this);

        this.scheduleOnce(() => {
            const vpCenterWorld = this.viewportUT.convertToWorldSpaceAR(Vec3.ZERO);
            const vpCenterLocal = this.contentUT.convertToNodeSpaceAR(vpCenterWorld);

            const halfViewH = this.viewportUT.height / 2;
            let timeDelay = 0.2;
            for (const item of this.items) {
                const ut = item.node.getComponent(UITransform)!;
                const itemCenterWorld = ut.convertToWorldSpaceAR(Vec3.ZERO);
                const itemCenterLocal = this.contentUT.convertToNodeSpaceAR(itemCenterWorld);

                const dy = Math.abs(itemCenterLocal.y - vpCenterLocal.y);

                // --- Cách A: đúng ý bạn (đơn giản) ---
                // const visibleA = dy <= (halfViewH + this.buffer);

                //--- (Tuỳ chọn) Cách B: tính luôn nửa chiều cao item để mượt hơn ---
                const visibleB = dy <= (halfViewH + ut.height / 2 + this.buffer);

                const visible = visibleB;
                if (visible && item.node.active) {
                    item.setShowItemWithTween(timeDelay);
                    timeDelay += 0.1;
                }
                else {
                    item.setHideItem();
                }
            }
        }, 0);
    }

    protected onDisable(): void {
        this.scrollView.node.off('scrolling', this.requestUpdate, this);
        this.scrollView.node.off('scroll-ended', this.updateVisibility, this);
    }

    start() {
        
    }

    update(deltaTime: number) {
        
    }

    private requestUpdate() {
        if (this.pending) return;
        this.pending = true;
        this.scheduleOnce(() => {
            this.pending = false;
            this.updateVisibility();
        }, 0);
    }

    /** Cắt theo khoảng cách tâm item với tâm viewport (trục dọc) */
    private updateVisibility = () => {
        // tâm viewport (world -> content-space)
        const vpCenterWorld = this.viewportUT.convertToWorldSpaceAR(Vec3.ZERO);
        const vpCenterLocal = this.contentUT.convertToNodeSpaceAR(vpCenterWorld);

        const halfViewH = this.viewportUT.height / 2;

        for (const item of this.items) {
            const ut = item.node.getComponent(UITransform)!;
            const itemCenterWorld = ut.convertToWorldSpaceAR(Vec3.ZERO);
            const itemCenterLocal = this.contentUT.convertToNodeSpaceAR(itemCenterWorld);

            const dy = Math.abs(itemCenterLocal.y - vpCenterLocal.y);

            // --- Cách A: đúng ý bạn (đơn giản) ---
            // const visibleA = dy <= (halfViewH + this.buffer);

            //--- (Tuỳ chọn) Cách B: tính luôn nửa chiều cao item để mượt hơn ---
            const visibleB = dy <= (halfViewH + ut.height / 2 + this.buffer);

            const visible = visibleB;

            if (visible && item.node.active) {
                item.setShowItem();
            }
            else{
                item.setHideItem();
            } 
        }
    };

    /** Gọi khi bạn thêm/xoá item lúc runtime */
    public refreshItemsList() {
        this.items = this.scrollView.content!.children
            .map(n => n.getComponent(ItemBaseScrollView))
            .filter(Boolean) as ItemBaseScrollView[];
        this.updateVisibility();
    }
}


