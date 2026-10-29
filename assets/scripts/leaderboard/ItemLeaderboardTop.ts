// @ts-nocheck
import { _decorator, Color, Component, instantiate, Label, Node, Prefab, SpriteFrame, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { ItemLeaderboard } from './ItemLeaderboard';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { PROFILE_TAB_TYPE, ProfileManager } from '../profile/ProfileManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
import { ItemLeaderboardBase } from '../common/ItemLeaderboardBase';
import { ItemLeaderboardGroupReward } from './ItemLeaderboardGroupReward';
import { LeaderboardManager } from './LeaderboardManager';
const { ccclass, property } = _decorator;

@ccclass('ItemLeaderboardTop')
export class ItemLeaderboardTop extends ItemLeaderboardBase {
    @property(Label)
    txtName: Label = null;

    @property({ type: Color, tooltip: 'Màu tên của chính người chơi trên bục Top 3.' })
    playerNameColor = new Color(4, 95, 19, 255);

    @property({ type: Color, tooltip: 'Màu viền tên của chính người chơi trên bục Top 3.' })
    playerNameOutlineColor = new Color(255, 255, 255, 255);

    private normalNameColor: Color | null = null;
    private normalNameOutlineColor: Color | null = null;
    private normalNameOutlineEnabled = false;

    @property(Label)
    txtScore: Label = null;

    /** Dùng LẠI Y HỆT component của hộp quà 3 dòng đầu trong scrollview (icon, sprite theo
     * hạng, bấm mở detail) — KHÔNG viết lại logic riêng. Bảng detail (DetailRewardGroup) khi
     * bấm mở vẫn là CÙNG 1 instance với scrollview (xem LeaderBoardGroupRewardManager
     * .detailRewardGroup) — reparent tới đâu do field ItemLeaderboardGroupReward
     * .parentDetailRewardGroup của CHÍNH node này quyết định (Editor: kéo vào 1 node KHÔNG bị
     * Mask của ScrollView cắt, ví dụ chính node TOP3), tránh bị Mask ScrollView cắt mất do TOP3
     * nằm NGOÀI vùng ScrollView. */
    @property({ type: ItemLeaderboardGroupReward, tooltip: 'Component hộp quà — y hệt cái dùng ở 3 dòng đầu trong scrollview, dùng chung 1 bảng detailRewardGroup.' })
    groupReward: ItemLeaderboardGroupReward = null;

    @property({
        type: Node,
        tooltip:
            'Viền vàng hiện khi bục này là CHÍNH người chơi — vì bg của top1/top2/top3 khác nhau cả ' +
            'kích thước lẫn vị trí, viền này PHẢI là node RIÊNG của ĐÚNG instance này, tự canh sẵn ' +
            '(kích thước + vị trí local) khớp bg của CHÍNH bục này ngay trong Editor — script chỉ ' +
            'bật/tắt + mờ dần (opacity), KHÔNG tự resize/định vị runtime. Để trống thì bỏ qua, không crash.',
    })
    goldBorder: Node | null = null;

    @property({ tooltip: 'Viền vàng: thời gian mờ dần HIỆN lên (giây) khi showGoldBorder(true, animate).' })
    goldBorderFadeInSeconds = 0.3;

    private goldBorderOpacity: UIOpacity | null = null;

    /** Hiện viền vàng — `animate=false` (mặc định, dùng lúc init() bục tĩnh/không leo hạng) snap
     * thẳng opacity đầy ngay; `animate=true` (dùng SAU KHI hiệu ứng avatar+frame leo hạng chạy
     * xong — xem LeaderboardPreviewManager.runTopSlotEntrance/flyAvatarFrameBetweenSlots) mờ dần
     * hiện lên qua goldBorderFadeInSeconds. */
    showGoldBorder(animate: boolean = false): void {
        if (!this.goldBorder) return;

        this.goldBorderOpacity ??= this.goldBorder.getComponent(UIOpacity) ?? this.goldBorder.addComponent(UIOpacity);
        Tween.stopAllByTarget(this.goldBorderOpacity);
        this.goldBorder.active = true;

        if (animate) {
            this.goldBorderOpacity.opacity = 0;
            tween(this.goldBorderOpacity).to(this.goldBorderFadeInSeconds, { opacity: 255 }).start();
        } else {
            this.goldBorderOpacity.opacity = 255;
        }
    }

    hideGoldBorder(): void {
        if (!this.goldBorder) return;

        if (this.goldBorderOpacity) Tween.stopAllByTarget(this.goldBorderOpacity);
        this.goldBorder.active = false;
    }

    /** `showGoldBorderNow=false` CHẶN hẳn việc init() tự quyết hiện/ẩn viền — dùng cho các bục đang
     * trong luồng leo hạng của LeaderboardPreviewManager (applySlotDataInstant), nơi viền vàng CHỈ
     * được hiện SAU KHI hiệu ứng avatar+frame chạy xong (gọi showGoldBorder() riêng ở đó), không
     * phải NGAY lúc data vừa đổi. Mặc định true — bục tĩnh (LeaderboardGroupWeek, hoặc
     * LeaderboardPreviewManager.buildTopSlots không leo hạng) tự hiện/ẩn ĐÚNG lúc init(), không cần
     * code gọi thêm gì cả. */
    init(_itemRankInfo: ItemRankInfo, _timeDelay: number = 0, showGoldBorderNow: boolean = true): Promise<void> {
        const loaded = super.init(_itemRankInfo, _timeDelay);

        if(this.txtName){
            if (!this.normalNameOutlineColor) {
                this.normalNameOutlineColor = this.txtName.outlineColor.clone();
                this.normalNameOutlineEnabled = this.txtName.enableOutline;
            }
            this.normalNameColor ??= this.txtName.color.clone();
            this.txtName.color = this.itemRankInfo.isMyRank ? this.playerNameColor : this.normalNameColor;
            this.txtName.outlineColor = this.itemRankInfo.isMyRank ? this.playerNameOutlineColor : this.normalNameOutlineColor;
            this.txtName.enableOutline = this.itemRankInfo.isMyRank || this.normalNameOutlineEnabled;
            this.txtName.string = ``;
            if(this.itemRankInfo.isMyRank){
                this.txtName.string = `${ProfileManager.instance.getName()}`;
            }else{
                if(this.itemRankInfo.userName != null && this.itemRankInfo.userName != 'undefined') {
                    this.txtName.string = `${this.itemRankInfo.userName}`;
                }
            }
        }

        if (this.txtScore) this.txtScore.string = `x${this.itemRankInfo.userScore}`;

        this.showGift();
        this.showItem();

        if (showGoldBorderNow) {
            if (this.itemRankInfo.isMyRank) this.showGoldBorder(false);
            else this.hideGoldBorder();
        }

        return loaded;
    }

    /** Hạng 1-3 luôn có thưởng — cùng nguồn dữ liệu với hộp quà ở 3 dòng đầu trong scrollview
     * (LeaderboardManager.leaderboardRewards, xem LeaderboardGroupWeek.showGroup()). */
    private showGift(): void {
        if (!this.groupReward) return;
        const indexRank = this.itemRankInfo?.indexRank ?? 0;
        const rewards = LeaderboardManager.instance?.leaderboardRewards;
        const rewardData = indexRank >= 1 && indexRank <= 3 ? rewards?.[indexRank - 1]?.rewards ?? null : null;
        this.groupReward.initReward(rewardData, indexRank - 1);
    }

}
