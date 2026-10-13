// @ts-nocheck
import { _decorator, Button, Component, instantiate, Label, Node, Prefab, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { BasePopup } from '../common/BasePopup';
import { Constants } from '../framework/constants';
import { GameResource } from '../datainfo/GameResource';
import { ItemTouchToContinue } from '../common/ItemTouchToContinue';
import { ItemRewardReceive } from '../common/ItemRewardReceive';
import { AdServiceHolder } from '../service/ads/AdServiceHolder';
const { ccclass, property } = _decorator;

/**
 * Bản rút gọn của RewardReceivePopup gốc (MagicSort) — chỉ giữ nhánh BOOSTER (Hint/Place Dog),
 * bỏ Coin/Heart/NoAds vì Dogdoku không có 3 hệ thống đó (xem ItemBaseShopBundle.touchBuy).
 */
@ccclass('RewardReceivePopup')
export class RewardReceivePopup extends BasePopup {

    @property(Label)
    txtTitle: Label = null;

    @property(Label)
    txtTitle_Shadow: Label = null;

    @property(Button)
    btnClaim: Button = null;

    @property({
        type: Button,
        tooltip:
            'Nút "Xem QC nhận x2" — hiện cùng lúc với btnClaim, chỉ dùng ĐƯỢC 1 LẦN mỗi lượt mở ' +
            'popup (xem onTouchWatchAdX2()). Bấm Claim vẫn nhận số lượng ĐÃ x2 nếu đã xem quảng cáo.',
    })
    btnWatchAdX2: Button = null;

    @property(ItemTouchToContinue)
    itemTouchToContinue: ItemTouchToContinue = null;

    @property(Node)
    groupRewards: Node = null;

    @property(Prefab)
    itemRewardReceivePrefab: Prefab = null;

    @property(Node)
    targetBoosterPos: Node = null;

    arrItemRewardReceives:ItemRewardReceive[] = [];

    onEnable(): void {
        super.onEnable();
        this.btnClaim?.node.on(Constants.CLICK, this.onTouchClaim, this);
        this.btnWatchAdX2?.node.on(Constants.CLICK, this.onTouchWatchAdX2, this);
    }

    onDisable(): void {
        super.onDisable();
        this.btnClaim?.node.off(Constants.CLICK, this.onTouchClaim, this);
        this.btnWatchAdX2?.node.off(Constants.CLICK, this.onTouchWatchAdX2, this);
    }
    gameResources:GameResource[] = null;
    /** true SAU KHI đã xem xong quảng cáo x2 trong phiên hiện tại — chặn bấm lại lần 2 (mỗi lượt
     * mở popup chỉ nhân đôi ĐÚNG 1 LẦN). Reset lại ở showRewardReceivePopup(). */
    private rewardDoubled = false;
    /** Chặn bấm x2 nhiều lần cùng lúc trong lúc await ads.showRewarded() đang chạy. */
    private watchAdInProgress = false;

    showRewardReceivePopup(_title:string,_gameResources:GameResource[],_cbWhenClose?: Function): void {
        this.gameResources = _gameResources;
        this.rewardDoubled = false;
        this.watchAdInProgress = false;
        if (this.btnClaim) {
            this.btnClaim.interactable = false;
            this.btnClaim.node.active = false;
        }
        if (this.btnWatchAdX2) {
            this.btnWatchAdX2.interactable = false;
            this.btnWatchAdX2.node.active = false;
        }
        this.itemTouchToContinue?.resetItem();

        if (!this.groupRewards || !this.itemRewardReceivePrefab) return;

        this.arrItemRewardReceives = [];
        this.groupRewards.destroyAllChildren();
        super.showPopup(_cbWhenClose);
        // Toàn bộ dữ liệu (title/gameResources) có sẵn ĐỒNG BỘ ngay tham số hàm này — không có
        // bước tải mạng/tài nguyên nào phải đợi, tắt loading NGAY (super.showPopup() vừa tự bật).
        this.hideLoading();
        if (this.txtTitle && this.txtTitle_Shadow) {
            this.txtTitle.string = this.txtTitle_Shadow.string = `${_title}`;
            this.txtTitle.node.active = true;
            this.txtTitle_Shadow.node.active = true;
        }
    }

    showPoup_ShowView_Finished(): void {
        super.showPoup_ShowView_Finished();
        this.showRewards();

        if (this.btnClaim) {
            this.btnClaim.node.active = true;
            this.playButtonAppearFade(this.btnClaim.node);
        }
        if (this.btnWatchAdX2 && !this.rewardDoubled) {
            this.btnWatchAdX2.node.active = true;
            this.playButtonAppearFade(this.btnWatchAdX2.node);
        }
        const enableButtons = () => {
            if (this.btnClaim) this.btnClaim.interactable = true;
            if (this.btnWatchAdX2 && !this.rewardDoubled) this.btnWatchAdX2.interactable = true;
        };
        // itemTouchToContinue CÓ THỂ chưa gán trong Editor (field trống) — không được để 2 nút kẹt
        // "interactable = false" mãi mãi trong trường hợp đó, nên tự bật NGAY nếu thiếu component.
        if (this.itemTouchToContinue) {
            this.itemTouchToContinue.showItem(1, enableButtons);
        } else {
            enableButtons();
        }
    }

    /** Hiện cả cụm nút (node cha + toàn bộ con) bằng cách mờ dần opacity — UIOpacity trên node CHA
     * tự nhân xuống hết các renderer con bên trong (Cocos 3.x), nên KHÔNG cần gắn UIOpacity riêng
     * cho từng label/icon con. */
    private playButtonAppearFade(node: Node): void {
        if (!node) return;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity).to(0.3, { opacity: 255 }, { easing: 'quadOut' }).start();
    }

    /**
     * Xem quảng cáo có thưởng để NHÂN ĐÔI toàn bộ phần thưởng đang hiện (giống cơ chế watchAdForHint/
     * watchAdForPlaceDog ở GameplayScreen — cùng dùng AdServiceHolder.current, không cần thêm hệ
     * thống quảng cáo riêng). Chỉ dùng được 1 lần/lượt mở popup — bấm Claim vẫn nhận số lượng ĐÃ x2.
     */
    private async onTouchWatchAdX2(): Promise<void> {
        if (this.rewardDoubled || this.watchAdInProgress || !this.gameResources) return;

        const ads = AdServiceHolder.current;
        if (!ads.isRewardedReady()) {
            console.log('[RewardReceivePopup] Chưa có quảng cáo sẵn sàng.');
            return;
        }

        this.watchAdInProgress = true;
        if (this.btnWatchAdX2) this.btnWatchAdX2.interactable = false;
        // Chặn bấm Nhận trong lúc đang xem QC — tránh nhận thưởng CHƯA x2 ngay trước khi quảng cáo
        // xem xong (race giữa 2 nút).
        if (this.btnClaim) this.btnClaim.interactable = false;
        try {
            const result = await ads.showRewarded();
            if (!this.node?.isValid) return;
            if (!result.rewarded) {
                console.log('[RewardReceivePopup] Không nhận thưởng x2:', result.reason ?? 'đã đóng sớm');
                if (this.btnWatchAdX2) this.btnWatchAdX2.interactable = true;
                if (this.btnClaim) this.btnClaim.interactable = true;
                return;
            }

            this.rewardDoubled = true;
            for (const resource of this.gameResources) {
                resource.Value.m_Value *= 2;
            }
            if (this.btnWatchAdX2) this.btnWatchAdX2.node.active = false;
            this.showRewards();
            // Xem QC xong là NHẬN LUÔN — không đợi bấm lại nút Nhận nữa.
            this.onTouchClaim();
        } finally {
            this.watchAdInProgress = false;
        }
    }




    showRewards(): void {
        if (!this.groupRewards || !this.itemRewardReceivePrefab) return;
        this.groupRewards.destroyAllChildren();
        this.arrItemRewardReceives = [];
        let countRewards = this.gameResources.length;
        for(let i = 0; i < this.gameResources.length; i++) {
            let item = instantiate(this.itemRewardReceivePrefab);
            item.setParent(this.groupRewards);
            let scaleAndPos = this.getScaleAndPositionItemRewardbyIndex(i,countRewards);
            item.setPosition(scaleAndPos.position);
            item.setScale(scaleAndPos.scale);
            let itemRewardReceive = item.getComponent(ItemRewardReceive);
            if (!itemRewardReceive) continue;
            let delayTime = i * 0.1 + 0.2;
            itemRewardReceive.initItemReward(this.gameResources[i],delayTime);
            this.arrItemRewardReceives.push(itemRewardReceive);
        }
    }




    getScaleAndPositionItemRewardbyIndex(index: number, countRewards: number): {scale: Vec3, position: Vec3} {
        const MAX_PER_ROW = 3;
        const ITEM_STEP = countRewards <= 3 ? 250 : 200;
        const ROW_GAP = 180;
        const scale = countRewards <= 3 ? 1.0 : 0.9;
        const GROUP_OFFSET_Y = -50;

        const totalRows = Math.ceil(countRewards / MAX_PER_ROW);
        const row = Math.floor(index / MAX_PER_ROW);
        const indexInRow = index % MAX_PER_ROW;

        const itemsInThisRow = row < totalRows - 1
            ? MAX_PER_ROW
            : countRewards - row * MAX_PER_ROW;

        const x = (indexInRow - (itemsInThisRow - 1) / 2) * ITEM_STEP;
        const y = ((totalRows - 1) / 2 - row) * ROW_GAP + GROUP_OFFSET_Y;

        const s = new Vec3(scale, scale, scale);
        return { scale: s, position: new Vec3(x, y, 0) };
    }

    onTouchClaim(): void {
        if (this.lockGroup) this.lockGroup.active = true;
        if (this.btnClaim) this.btnClaim.node.active = false;
        // Y HỆT thời điểm/cách biến mất của btnClaim — kể cả khi người chơi bấm "Nhận" THẲNG,
        // không qua luồng xem QC x2 (btnWatchAdX2 lúc đó vẫn đang hiện, phải biến mất CÙNG lúc).
        if (this.btnWatchAdX2) this.btnWatchAdX2.node.active = false;
        if (this.txtTitle) this.txtTitle.node.active = false;
        if (this.txtTitle_Shadow) this.txtTitle_Shadow.node.active = false;
        if(this.bgOpacity){
            this.tweenOpacityBG = tween(this.bgOpacity).to(0.8, { opacity: 0 }, {
                easing: 'quadIn', onComplete: () => {

                }
            }).start();
        }

        for(let i=0; i< this.arrItemRewardReceives.length; i++){
            let delayTime:number = 0.1 * i;
            let targetPos = this.targetBoosterPos ? this.targetBoosterPos.worldPosition : Vec3.ZERO;
            this.arrItemRewardReceives[i].setItemReward_Receive(delayTime,targetPos);
        }

        let timeClosePopup = 0.1 * this.arrItemRewardReceives.length + 0.8;

        this.scheduleOnce(() => {
            this.hidePopup_Finished();
        }, timeClosePopup);
    }

    hidePopup_Finished(): void {
        super.hidePopup_Finished();
        if (this.cbWhenClose) {
            this.cbWhenClose();
        }
    }
}
