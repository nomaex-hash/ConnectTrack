// @ts-nocheck
import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { RewardReceivePopup } from './RewardReceivePopup';
const { ccclass, property } = _decorator;

/**
 * Lắng nghe Constants.SHOW_REWARD_RECEIVE_POPUP (bắn từ ItemShopBundle1/StarterPackPopup khi mua
 * thành công) và hiện RewardReceivePopup. Bản gốc việc này nằm trong HomeSceneManager.ts (scene-
 * controller khổng lồ không copy sang Dogdoku) — đây là bản rút gọn chỉ làm đúng 1 việc này, đặt
 * trực tiếp trong scene đang chạy (không qua UIManager/PopupId vì RewardReceivePopup kế thừa
 * BasePopup của framework gốc, khác interface UIPopup của Dogdoku).
 */
@ccclass('RewardReceivePopupHolder')
export class RewardReceivePopupHolder extends Component {
    @property(Prefab)
    rewardReceivePopupPrefab: Prefab = null;

    @property(Node)
    parentPopup: Node = null;

    private rewardReceivePopup: RewardReceivePopup = null;

    protected onEnable(): void {
        clientEvent.on(Constants.SHOW_REWARD_RECEIVE_POPUP, this.showRewardReceivePopup, this);
    }

    protected onDisable(): void {
        clientEvent.off(Constants.SHOW_REWARD_RECEIVE_POPUP, this.showRewardReceivePopup, this);
    }

    showRewardReceivePopup(title: string, arrGameResources: unknown[], callback?: Function): void {
        if (!this.rewardReceivePopupPrefab) {
            console.warn('[RewardReceivePopupHolder] Chưa gán rewardReceivePopupPrefab.');
            if (callback) callback();
            return;
        }

        const parent = this.parentPopup ?? this.node;
        if (this.rewardReceivePopup) {
            this.rewardReceivePopup.node.setSiblingIndex(999);
            this.rewardReceivePopup.showRewardReceivePopup(title, arrGameResources, callback);
            return;
        }

        const uiPopup = instantiate(this.rewardReceivePopupPrefab);
        uiPopup.setParent(parent);
        uiPopup.setSiblingIndex(999);

        this.rewardReceivePopup = uiPopup.getComponent(RewardReceivePopup);
        if (!this.rewardReceivePopup) {
            console.warn('[RewardReceivePopupHolder] Prefab thiếu component RewardReceivePopup.');
            if (callback) callback();
            return;
        }
        this.rewardReceivePopup.showRewardReceivePopup(title, arrGameResources, callback);
    }
}
