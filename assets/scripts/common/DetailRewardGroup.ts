// @ts-nocheck
import { _decorator, CCBoolean, Component, instantiate, Node, Prefab, tween, Tween, UITransform, Vec3 } from 'cc';
import { GameResource } from '../datainfo/GameResource';
import { ItemSlotReward } from './ItemSlotReward';
import { ItemRewardBox } from '../shop/ItemRewardBox';
const { ccclass, property } = _decorator;

@ccclass('DetailRewardGroup')
export class DetailRewardGroup extends Component {
    @property(Node)
    nodeRewardGroup:Node = null;

    @property(Prefab)
    itemRewardBoxPrefab:Prefab = null;
    tweenShow:Tween<{}> = null;
    showState:number = 0;

    @property(UITransform)
    bgRewards:UITransform = null;
    
    STATE_NONE:number = 0;
    STATE_SHOWING:number = 1;
    STATE_SHOWED:number = 2;
    // static currentShowing: DetailRewardGroup | null = null;
    initGroup(gameResources:GameResource[]){
        // Tween.stopAllByTarget (KHÔNG chỉ .stop() trên 1 tham chiếu this.tweenShow cụ thể) — bấm
        // sang hộp quà KHÁC trong lúc bảng cũ đang hiện dở (chưa hết 2s) trước đây có thể để sót
        // action cũ (chuỗi .to().delay().to().union() không luôn bị huỷ sạch giữa chừng), khiến
        // bảng MỚI vừa hiện lên đã bị action CŨ (đang chờ hết delay) ép ẩn/thu nhỏ ngay lập tức.
        Tween.stopAllByTarget(this.node);
        this.showState = this.STATE_NONE;
        // Guard gameResources null — item vừa bấm chưa có dữ liệu thưởng (timing lúc load, hoặc
        // hạng đó không nằm trong danh sách tier thưởng cấu hình) — trước đây đọc .length trên
        // null crash luôn cả hàm, không mở được bảng nào nữa.
        if (!this.nodeRewardGroup || !this.itemRewardBoxPrefab || !gameResources) return;
        this.nodeRewardGroup.removeAllChildren();
        let countRewards = gameResources.length;
        for (let i = 0; i < gameResources.length; i++) {
            const gameResource = gameResources[i];
            const item = instantiate(this.itemRewardBoxPrefab);
            // Guard: itemRewardBoxPrefab chưa gắn component ItemRewardBox (chưa gắn trong Editor),
            // hoặc trỏ nhầm prefab khác — bỏ qua dòng này thay vì crash cả nhóm reward.
            item.getComponent(ItemRewardBox)?.initItemReward(gameResource);
            item.setParent(this.nodeRewardGroup);
        }
        if(this.bgRewards) this.bgRewards.width = countRewards * 85 + 40;
        this.showGroup();
    }
    /** Luôn (re)hiện từ đầu — KHÔNG toggle-đóng khi bấm lại hộp quà đang hiện, đổi lại đảm bảo
     * KHÔNG BAO GIỜ bị kẹt ở trạng thái lỡ dở (ví dụ vừa mới bấm hộp quà khác xong action cũ chưa
     * kịp huỷ sạch). */
    showGroup(){
        Tween.stopAllByTarget(this.node);
        this.showState = this.STATE_SHOWING;
        this.node.active = true;
        this.node.setScale(new Vec3(0,0,0));
        this.tweenShow = tween(this.node).to(0.3,{scale: new Vec3(1,1,1)}, { easing: 'backOut',onComplete:()=>{
                            this.showState = this.STATE_SHOWED;
                        }})
                        .delay(2)
                        .call(() => this.hideGroup())
                        .start();
    }

    hideGroup(){
        Tween.stopAllByTarget(this.node);
        if (!this.node || !this.node.isValid) return;
        this.node.active = false;
        this.showState = this.STATE_NONE;

    }
}


