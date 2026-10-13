// @ts-nocheck
import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { LeaderboardInfoPopup } from './LeaderboardInfoPopup';
const { ccclass, property } = _decorator;

/**
 * Lắng nghe SHOW_LEADERBOARD_INFO_POPUP (bắn từ LeaderboardGroupWeek.onTouchInfo()) và hiện popup
 * giới thiệu giải đấu — cùng mẫu với ProfilePopupHolder/RewardReceivePopupHolder.
 */
@ccclass('LeaderboardInfoPopupHolder')
export class LeaderboardInfoPopupHolder extends Component {
    @property(Prefab)
    leaderboardInfoPopupPrefab: Prefab = null;

    @property(Node)
    parentPopup: Node = null;

    private popup: LeaderboardInfoPopup = null;

    protected onEnable(): void {
        clientEvent.on(Constants.SHOW_LEADERBOARD_INFO_POPUP, this.showLeaderboardInfoPopup, this);
    }

    protected onDisable(): void {
        clientEvent.off(Constants.SHOW_LEADERBOARD_INFO_POPUP, this.showLeaderboardInfoPopup, this);
    }

    private get parent(): Node {
        return this.parentPopup ?? this.node;
    }

    showLeaderboardInfoPopup(): void {
        if (!this.leaderboardInfoPopupPrefab) {
            console.warn('[LeaderboardInfoPopupHolder] Chưa gán leaderboardInfoPopupPrefab.');
            return;
        }
        if (this.popup) {
            this.popup.node.setSiblingIndex(999);
            this.popup.showPopup();
            return;
        }
        const node = instantiate(this.leaderboardInfoPopupPrefab);
        node.setParent(this.parent);
        node.setSiblingIndex(999);
        this.popup = node.getComponent(LeaderboardInfoPopup);
        if (!this.popup) {
            console.warn('[LeaderboardInfoPopupHolder] Prefab thiếu component LeaderboardInfoPopup.');
            return;
        }
        this.popup.showPopup();
    }
}
