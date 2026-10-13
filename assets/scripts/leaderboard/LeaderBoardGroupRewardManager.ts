// @ts-nocheck
import { _decorator, Component, Node, Vec3 } from 'cc';
import { LeaderBoardGroupBaseManager } from './LeaderBoardGroupBaseManager';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { GameResource, ResourceRewards } from '../datainfo/GameResource';
import { ItemLeaderboardEntryReward } from './ItemLeaderboardEntryReward';
import { ItemLeaderboardEntryBase } from '../common/ItemLeaderboardEntryBase';
import { DetailRewardGroup } from '../common/DetailRewardGroup';
import { clientEvent } from '../framework/clientEvent';
import { Constants } from '../framework/constants';
import { ItemLeaderboardGroupReward } from './ItemLeaderboardGroupReward';
const { ccclass, property } = _decorator;

@ccclass('LeaderBoardGroupRewardManager')
export class LeaderBoardGroupRewardManager extends LeaderBoardGroupBaseManager {
    @property(DetailRewardGroup)
    detailRewardGroup:DetailRewardGroup;

    @property(DetailRewardGroup)
    myDetailRewardGroup:DetailRewardGroup;

    protected onEnable(): void {
        super.onEnable();

        clientEvent.on(Constants.LEADERBOARD_SHOW_DETAIL_REWARD,this.showDetailRewardGroup,this);
    }

    protected onDisable(): void {
        super.onDisable();

        clientEvent.off(Constants.LEADERBOARD_SHOW_DETAIL_REWARD,this.showDetailRewardGroup,this);
    }


    resourceRewards:ResourceRewards[] = [];
    initRewards(_resourceRewards:ResourceRewards[]):void{
        this.resourceRewards = _resourceRewards
    }

    /**
     * showDetailRewardGroup() reparent detailRewardGroup VÀO contentGroup để định vị đúng chỗ
     * item vừa bấm — nếu resetRankGroup() (chạy mỗi lần tab được mở lại) gọi thẳng
     * contentGroup.destroyAllChildren() thì detailRewardGroup bị PHÁ HUỶ theo (đang là con lúc
     * đó), lần bấm hộp quà sau sẽ crash vì node đã destroy. Đưa nó ra khỏi contentGroup TRƯỚC
     * khi super.resetRankGroup() chạy destroyAllChildren().
     */
    resetRankGroup(): void {
        if (this.detailRewardGroup?.node?.isValid && this.detailRewardGroup.node.parent === this.contentGroup) {
            this.detailRewardGroup.node.setParent(this.node);
            this.detailRewardGroup.node.active = false;
        }
        this.lastRewardDetailSource = null;
        super.resetRankGroup();
    }
    /** Tra thưởng theo HẠNG THẬT (itemRankInfo.indexRank - 1), KHÔNG dùng thẳng vị trí mảng
     * (arrayIndex) — từ khi hạng 1-3 bị lọc bỏ khỏi scrollview (chỉ còn hạng 4 trở đi, xem
     * LeaderboardGroupWeek.receiveListRankLeaderboard()), vị trí mảng KHÔNG còn trùng với
     * (hạng - 1) nữa: dòng ĐẦU TIÊN trong mảng giờ là hạng 4 (arrayIndex 0) chứ không phải hạng 1.
     * Nếu vẫn tra resourceRewards[arrayIndex] như cũ, hạng 4/5/6 (arrayIndex 0/1/2) sẽ VÔ TÌNH lấy
     * nhầm đúng 3 tier thưởng dành cho hạng 1/2/3 — đúng bug hộp quà xuất hiện ở hạng 4-6. */
    private getRewardsForRankInfo(itemRankInfo: ItemRankInfo | undefined): GameResource[] | null {
        if (!itemRankInfo) return null;
        const rewardIndex = itemRankInfo.indexRank - 1;
        const resourceReward = this.resourceRewards?.[rewardIndex];
        return resourceReward?.rewards ?? null;
    }

    /** Trả về Promise xong khi TOÀN BỘ dòng (scrollview + myItem) đã tải xong avatar/frame — gộp
     * (Promise.all) để LeaderboardGroupWeek biết lúc nào mới tắt nodeLoading + "mở" bảng xếp hạng
     * (xác nhận từ user). */
    initRankGroup(_arrItemRewardInfos:ItemRankInfo[]): Promise<void> {
        super.initRankGroup(_arrItemRewardInfos);
        const loads: Promise<void>[] = [];
        for (let i = 0; i < this.countShowItem; i++) {
            if (i < this.arrItemRankInfos.length) {
                let itemLeaderBoard: ItemLeaderboardEntryBase= this.getItemLeaderBoard_Recycle_FromPools();
                if (!itemLeaderBoard) continue;
                itemLeaderBoard.node.setPosition(this.getPos_byIndex(i));
                loads.push(itemLeaderBoard.init(this.arrItemRankInfos[i], 0.1 * i));
                itemLeaderBoard.setIndexPos(i);
                let itemLeaderBoardReward:ItemLeaderboardEntryReward = itemLeaderBoard.getComponent(ItemLeaderboardEntryReward);
                const rewards = this.getRewardsForRankInfo(this.arrItemRankInfos[i]);
                itemLeaderBoardReward.initGroupReward(rewards,i);
                this.mapItemBoards.set(i, itemLeaderBoard);
            }
        }

        for (let i = 0; i < this.arrItemRankInfos.length; i++) {
            if (this.arrItemRankInfos[i].isMyRank) {
                if (this.myItemLeaderBoard) {
                    loads.push(this.myItemLeaderBoard.init(this.arrItemRankInfos[i]));
                    let myItemLeaderBoardReward:ItemLeaderboardEntryReward = this.myItemLeaderBoard.getComponent(ItemLeaderboardEntryReward);
                    const rewards = this.getRewardsForRankInfo(this.arrItemRankInfos[i]);
                    myItemLeaderBoardReward.initGroupReward(rewards,i);
                    this.myItemLeaderBoard.node.active = true;
                }
            }
        }

        if (this.indexMyRank > -1 && this.myItemLeaderBoard) {
            if (this.mapItemBoards.has(this.indexMyRank)) {
                this.isShowMyRank = false;
                this.myItemLeaderBoard.node.active = false;
            } else {
                this.isShowMyRank = true;
                this.myItemLeaderBoard.node.active = true;
            }
        } else if (this.myItemLeaderBoard) {
            // indexMyRank == -1: người chơi KHÔNG nằm trong danh sách truyền vào đây — giờ luôn
            // đúng khi người chơi đang ở hạng 1-3 (TOP3), vì LeaderboardGroupWeek đã LỌC BỎ hạng
            // 1-3 khỏi mảng truyền vào initRankGroup() (chỉ còn hạng 4 trở đi, xem
            // receiveListRankLeaderboard()). Trước đây nhánh này bị BỎ QUA hoàn toàn, khiến dòng
            // "tôi" ghim giữ NGUYÊN trạng thái active cũ (có thể đang hiện dở từ lần render trước,
            // lúc người chơi còn ở hạng 4+) — phải tắt hẳn tường minh ở đây.
            this.isShowMyRank = false;
            this.myItemLeaderBoard.node.active = false;
        }

        return Promise.all(loads).then(() => {});
    }

    updateItemRank(indexPos: number) {
        super.updateItemRank(indexPos);
        let itemLeaderBoard: ItemLeaderboardEntryBase = this.getItemLeaderBoard_Recycle_FromPools();
        if (!itemLeaderBoard) return;
        if(this.myDetailRewardGroup?.node.active){
            this.myDetailRewardGroup.hideGroup();
        }

        if (indexPos < this.arrItemRankInfos.length) {
            itemLeaderBoard.node.setPosition(this.getPos_byIndex(indexPos));
            itemLeaderBoard.init(this.arrItemRankInfos[indexPos]);
            let itemLeaderBoardReward: ItemLeaderboardEntryReward = itemLeaderBoard.getComponent(ItemLeaderboardEntryReward);
            const rewards = this.getRewardsForRankInfo(this.arrItemRankInfos[indexPos]);
            itemLeaderBoardReward.initGroupReward(rewards,indexPos);
            
            itemLeaderBoard.setIndexPos(indexPos);
            this.mapItemBoards.set(indexPos, itemLeaderBoard);
            itemLeaderBoard.node.active = true;
        }
    }

    /** Hộp quà đang hiện popup chi tiết thưởng gần nhất — CỐ TÌNH so sánh theo THAM CHIẾU
     * instance (KHÔNG dùng số indexRankReward như trước) — TOP3 (ItemLeaderboardTop.groupReward)
     * và 3 dòng đầu scrollview dùng CHUNG dải giá trị indexRankReward 0/1/2 (cùng ý nghĩa hạng
     * 1/2/3), nên nếu so bằng SỐ, bấm hộp quà scrollview hạng 2 rồi bấm sang hộp quà TOP3 hạng 2
     * sẽ bị tưởng "vẫn là hộp cũ" (trùng số 1), showDetailRewardGroup() chỉ showGroup() lại chứ
     * KHÔNG initGroup() rebuild nội dung — hộp quà bấm sau (TOP3) bị lộ nhầm nội dung/trạng thái
     * của hộp bấm trước (scrollview), có thể trống nếu lần trước đó early-return vì gameResources
     * rỗng. So theo instance loại bỏ hẳn khả năng đụng độ này (2 item luôn là 2 instance khác
     * nhau dù đứng chung 1 index number). */
    lastRewardDetailSource: ItemLeaderboardGroupReward | null = null;
    showDetailRewardGroup(itemLeaderboardGroupReward:ItemLeaderboardGroupReward){
        if (!this.myDetailRewardGroup || !this.detailRewardGroup) return;
        let isMyLeaderBoardReward:boolean = itemLeaderboardGroupReward.isMyItemLeadboardReward;
        if(isMyLeaderBoardReward){
            this.myDetailRewardGroup.node.active = true;
            if(this.myDetailRewardGroup.showState == 2){
                this.myDetailRewardGroup.showGroup();
            }else{
                this.myDetailRewardGroup.initGroup(itemLeaderboardGroupReward.gameResources);
            }

            this.detailRewardGroup.hideGroup();
        }else{

            this.myDetailRewardGroup.hideGroup();
            // 1 bảng detail DUY NHẤT (this.detailRewardGroup) dùng chung cho MỌI hộp quà — cả
            // dòng trong scrollview lẫn TOP3 — cùng 1 logic bấm/hiện (initGroup/showGroup/z-order/
            // chống trùng lặp) bên dưới. Khác biệt DUY NHẤT là nơi reparent tới: hộp quà trong
            // scrollview (con/cháu của contentGroup) LUÔN vào contentGroup, để đúng vị trí + luôn
            // vẽ trên các dòng khác. Hộp quà TOP3 nằm NGOÀI contentGroup (ngoài vùng Mask của
            // ScrollView) nên bắt buộc dùng node neo ngoài Mask (parentDetailRewardGroup) — nếu
            // cũng đưa vào contentGroup sẽ bị Mask cắt mất (vô hình).
            const isInsideScrollContent = !!this.contentGroup && itemLeaderboardGroupReward.node.isChildOf(this.contentGroup);
            const reparentTarget = isInsideScrollContent ? this.contentGroup : itemLeaderboardGroupReward.parentDetailRewardGroup;
            if (!reparentTarget || !this.detailRewardGroup.node) return;
            let worldPos: Vec3 = itemLeaderboardGroupReward.node.worldPosition.clone();
            this.detailRewardGroup.node.setParent(reparentTarget);
            this.detailRewardGroup.node.setWorldPosition(worldPos);
            this.detailRewardGroup.node.setSiblingIndex(-1);
            if (this.lastRewardDetailSource !== itemLeaderboardGroupReward) {
                this.lastRewardDetailSource = itemLeaderboardGroupReward;
                this.detailRewardGroup.node.active = true;
                this.detailRewardGroup.initGroup(itemLeaderboardGroupReward.gameResources);
            } else {
                this.detailRewardGroup.node.active = true;
                this.detailRewardGroup.showGroup();
            }
        }
    }
}


