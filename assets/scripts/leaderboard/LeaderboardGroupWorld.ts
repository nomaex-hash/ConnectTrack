// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { LeaderBoardGroupManager } from './LeaderBoardGroupManager';
import { LeaderboarBaseGroup } from './LeaderboarBaseGroup';
import { LeaderboardManager } from './LeaderboardManager';
import { LeaderboardDataInfo } from '../common/LeaderboardDataInfo';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { AVATAR_TYPE, Constants, ENV_TYPE } from '../framework/constants';
import { localConfig } from '../localConfig';
import { ProfileManager } from '../profile/ProfileManager';
import { PGSPlayInstantManager } from '../common/PGSPlayInstantManager';
import { clientEvent } from '../framework/clientEvent';
import { LeaderBoardGroupNormalManager } from './LeaderBoardGroupNormalManager';
const { ccclass, property } = _decorator;

@ccclass('LeaderboardGroupWorld')
export class LeaderboardGroupWorld extends LeaderboarBaseGroup {
    @property(LeaderBoardGroupNormalManager)
    leaderBoardGroupManager:LeaderBoardGroupNormalManager = null;
    @property(Node)
    nodeLoading:Node = null!;

    protected onEnable(): void {
        clientEvent.on(Constants.PGS_RECEIVE_LISTRANK_LEADERBOARD,this.setReceiveListRankLeaderboard,this);
    }

    protected onDisable(): void {
        clientEvent.off(Constants.PGS_RECEIVE_LISTRANK_LEADERBOARD,this.setReceiveListRankLeaderboard,this);
    }
    resetGroup(): void {
        super.resetGroup();
        this.leaderBoardGroupManager?.resetRankGroup();
    }

    showGroup(): void {
        if (this.nodeLoading) this.nodeLoading.active = true;
        super.showGroup();
        if (!LeaderboardManager.instance) return;

        let strWorldContextID: string = LeaderboardManager.instance.getWorldContextID();
        // console.log("strWorldContextID", strWorldContextID);
        let leaderboardDataInfo: LeaderboardDataInfo = LeaderboardManager.instance.getLeaderBoardDataInfo_byContextID(strWorldContextID);
        // console.log("leaderboardDataInfo", leaderboardDataInfo);
        // GetTopPlayers_byLeaderboardID() chỉ thật sự gọi API khi envType==FB (xem LeaderboardGroupWeek
        // cho lý do đầy đủ) — mọi env khác nó kẹt nodeLoading mãi, chỉ đi nhánh PGS khi thật sự FB.
        if (leaderboardDataInfo != null && localConfig.instance.envType == ENV_TYPE.FB) {
            if (LeaderboardManager.instance.mapLeaderBoard_ItemRankInfos.has(leaderboardDataInfo._id)) {
                this.receiveListRankLeaderboard(LeaderboardManager.instance.mapLeaderBoard_ItemRankInfos.get(leaderboardDataInfo._id));
            } else {
                if (this.nodeLoading) this.nodeLoading.active = true;
                PGSPlayInstantManager.instance?.GetTopPlayers_byLeaderboardID(leaderboardDataInfo._id, leaderboardDataInfo.tournamentId);
            }
        } else {
            if (localConfig.instance.envType == ENV_TYPE.TEST_AD) {
                // Điểm bot đọc từ cache dùng chung trong LeaderboardManager — KHÔNG reset theo
                // tuần (Global là tổng dồn vĩnh viễn), bot "chơi thêm" mỗi khi người chơi thắng 1
                // màn thật, cùng cơ chế Group A/B/C/D như Weekly (xem LeaderboardGroupWeek).
                const fakeBotScores = LeaderboardManager.instance?.getFakeBotGlobalScores() ?? [];
                // Tên + avatar bot đọc từ cache dùng chung trong LeaderboardManager — CỐ ĐỊNH
                // suốt phiên chơi (Global không reset theo tuần), KHÔNG random lại mỗi lần mở tab
                // (xem giải thích chi tiết ở LeaderboardManager.getFakeBotGlobalIdentities()).
                const fakeBotIdentities = LeaderboardManager.instance?.getFakeBotGlobalIdentities() ?? [];

                let arrListLeaderboard_Ranks: ItemRankInfo[] = [];
                for (let i = 0; i < fakeBotScores.length; i++) {
                    let itemRankInfo: ItemRankInfo = new ItemRankInfo();
                    itemRankInfo.userName = fakeBotIdentities[i]?.userName ?? "";
                    itemRankInfo.avatarType = AVATAR_TYPE.TYPE_LOCAL;
                    itemRankInfo.userScore = fakeBotScores[i];
                    itemRankInfo.avatarURL = fakeBotIdentities[i]?.avatarURL ?? "";
                    itemRankInfo.indexRank = i + 1;
                    // Bot KHÔNG BAO GIỜ được đánh dấu isMyRank (dòng "tôi" luôn tạo riêng bên
                    // dưới trong receiveListRankLeaderboard, dùng currLevelUnlock thật) — bản gốc
                    // có "if (i==60) isMyRank=true" nhưng loop chỉ chạy tới 50 nên chưa từng thật
                    // sự chạy, giữ nguyên hành vi false cho rõ ràng thay vì code chết khó hiểu.
                    itemRankInfo.isMyRank = false;
                    itemRankInfo.playerID = "" + (i + 1);
                    arrListLeaderboard_Ranks.push(itemRankInfo);
                }
                this.receiveListRankLeaderboard(arrListLeaderboard_Ranks);
            } else {
                this.receiveListRankLeaderboard([]);
            }
        }
    }

    receiveListRankLeaderboard(arrListRankInfos: ItemRankInfo[]) {
        let myItemRankInfo: ItemRankInfo = null;
        let indeMyRank: number = arrListRankInfos.findIndex(item => item.isMyRank == true);
        if (indeMyRank > -1) {
            myItemRankInfo = arrListRankInfos[indeMyRank];
            myItemRankInfo.userScore = localConfig.instance.currLevelUnlock;
        } else {
            myItemRankInfo = new ItemRankInfo();
            myItemRankInfo.avatarType = AVATAR_TYPE.TYPE_WEB;
            myItemRankInfo.avatarURL = ProfileManager.instance.getAvatarURL();
            myItemRankInfo.idFB = localConfig.instance.playerID;
            myItemRankInfo.indexRank = 100;
            myItemRankInfo.isMyRank = true;
            myItemRankInfo.userName = ProfileManager.instance.getName();
            myItemRankInfo.userScore = localConfig.instance.currLevelUnlock;
            arrListRankInfos.push(myItemRankInfo);
        }

        arrListRankInfos.sort((a, b) => {
            return b.userScore - a.userScore;
        });

        for (let i = 0; i < arrListRankInfos.length; i++) {
            arrListRankInfos[i].indexRank = i + 1;
        }
        if (this.nodeLoading) this.nodeLoading.active = false;
        this.leaderBoardGroupManager?.initRankGroup(arrListRankInfos);
    }

    setReceiveListRankLeaderboard(strLeaderboardID: string) {
        if (!LeaderboardManager.instance) return;
        let strWorldContextID: string = LeaderboardManager.instance.getWorldContextID();
        // console.log("strWorldContextID", strWorldContextID);
        let leaderboardDataInfo: LeaderboardDataInfo = LeaderboardManager.instance.getLeaderBoardDataInfo_byContextID(strWorldContextID);
        // console.log("leaderboardDataInfo", leaderboardDataInfo);
        if (leaderboardDataInfo != null && leaderboardDataInfo._id == strLeaderboardID) {
            let arrListRankInfos: ItemRankInfo[] = LeaderboardManager.instance.getLeaderboardItemRankInfos_byID(strLeaderboardID);
            this.receiveListRankLeaderboard(arrListRankInfos);
        }
    }
}


