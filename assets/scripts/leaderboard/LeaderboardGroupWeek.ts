// @ts-nocheck
import { _decorator, Button, Component, Node, isValid } from 'cc';
import { LeaderboarBaseGroup } from './LeaderboarBaseGroup';
import { LeaderBoardGroupManager } from './LeaderBoardGroupManager';
import { ItemLeaderboard } from './ItemLeaderboard';
import { localConfig } from '../localConfig';
import { LeaderboardManager } from './LeaderboardManager';
import { LeaderboardDataInfo } from '../common/LeaderboardDataInfo';
import { PGSPlayInstantManager } from '../common/PGSPlayInstantManager';
import { AVATAR_TYPE, Constants, ENV_TYPE } from '../framework/constants';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { ProfileManager } from '../profile/ProfileManager';
import { lodash } from '../framework/lodash';
import { clientEvent } from '../framework/clientEvent';
import { ItemLeaderboardTop } from './ItemLeaderboardTop';
import { LeaderBoardGroupRewardManager } from './LeaderBoardGroupRewardManager';
import { GameResourceConfigManager } from '../gameresource/GameResourceConfigManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

@ccclass('LeaderboardGroupWeek')
export class LeaderboardGroupWeek extends LeaderboarBaseGroup {
    @property(LeaderBoardGroupRewardManager)
    leaderBoardGroupManager:LeaderBoardGroupRewardManager = null;

    @property(Button)
    btnInfo:Button = null!;

    @property(ItemLeaderboardTop)
    arrItemLeaderboardTops:ItemLeaderboardTop[] = [];

    @property(Node)
    nodeLoading:Node = null!;

    /** Tăng mỗi lần showGroup() chạy — chặn 1 lần tải CŨ (showGroup gọi lại trước khi lần trước
     * kịp xong, ví dụ đổi tab ra/vào nhanh) tắt nhầm nodeLoading của lần tải MỚI đang còn dở. */
    private loadToken = 0;

    /** Resolve đúng lúc avatar/frame + rank list của lần showGroup() GẦN NHẤT đã xong hết và ổn
     * định (cùng mốc TOP3/scrollView tự bật active trong receiveListRankLeaderboard()) — nơi gọi
     * ngoài (LeaderboardTabGroupManager) dùng để biết lúc nào mới "mở" hẳn phần còn lại (tiêu đề/
     * đồng hồ/banner) — xác nhận từ user: "điều kiện để mở leaderboard là khi avatar/frame đã tải
     * xong và ổn định rồi thì mới mở". */
    private readyResolve: (() => void) | null = null;
    private readyPromise: Promise<void> = Promise.resolve();

    /** Callback ĐỒNG BỘ, gọi NGAY TRONG CÙNG lệnh với lúc nodeLoading tắt + TOP3/scrollview bật
     * active (xem receiveListRankLeaderboard) — khác whenReady() (qua Promise, luôn trễ thêm ít
     * nhất 1 microtask vì readyResolve() được gọi TỪ BÊN TRONG 1 .then() khác): dùng cho những nơi
     * CẦN hiện ĐÚNG lúc nodeLoading tắt, không sớm/muộn hơn dù chỉ 1 nhịp (xác nhận từ user: "icon
     * loading đang tắt quá sớm" — LeaderboardTabGroupManager chuyển sang đăng ký qua đây thay vì
     * whenReady().then()). Gọi NHIỀU LẦN đăng ký được nhiều callback (mảng), mỗi lần showGroup()
     * chạy lại sẽ reset danh sách (không gọi lại callback của lần TRƯỚC khi lần tải MỚI xong).
     */
    private readyCallbacks: (() => void)[] = [];
    onReady(callback: () => void): void {
        this.readyCallbacks.push(callback);
    }

    whenReady(): Promise<void> {
        return this.readyPromise;
    }

    protected onEnable(): void {
        super.onEnable();
        this.btnInfo?.node.on(Button.EventType.CLICK, this.onTouchInfo, this);

        clientEvent.on(Constants.PGS_RECEIVE_LISTRANK_LEADERBOARD,this.setReceiveListRankLeaderboard,this);
    }

    protected onDisable(): void {
        super.onDisable();
        this.btnInfo?.node.off(Button.EventType.CLICK, this.onTouchInfo, this);

        clientEvent.off(Constants.PGS_RECEIVE_LISTRANK_LEADERBOARD,this.setReceiveListRankLeaderboard,this);
    }

    resetGroup(): void {
        for(let i=0; i< this.arrItemLeaderboardTops.length;i++){
            this.arrItemLeaderboardTops[i].node.active = false;
        }
        super.resetGroup();

        this.leaderBoardGroupManager?.resetRankGroup();
    }
    
    showGroup(): void {
        // if(!LeaderboardManager.instance.getLeaderboardTutorialCompleted()){
        //     LeaderboardManager.instance.setLeaderboardTutorialCompleted();
        //     clientEvent.dispatchEvent(Constants.SHOW_LEADERBOARD_INFO_POPUP);
        // }
        // I want to get 3 first itemleaderboard top rewards to arrItemLeaderboardTops?
        // this.arrItemLeaderboardTops = [];
        // bắt đầu push 3 itemleaderboard top vào arrItemLeaderboardTops
        

        // LOG TẠM ĐỂ DEBUG (báo lỗi của user — "icon tắt quá nhanh, leaderboard còn chưa hiện") —
        // xoá sau khi xác định được nguyên nhân thật từ log console thực tế.
        console.log('[DEBUG nodeLoading] showGroup() called, token sẽ là', this.loadToken + 1, 'lúc', performance.now().toFixed(0));
        if (this.nodeLoading) this.nodeLoading.active = true;
        this.readyPromise = new Promise<void>((resolve) => { this.readyResolve = resolve; });
        this.readyCallbacks = [];
        super.showGroup();
        if (!LeaderboardManager.instance) return;
        console.log("LeaderboardGroupWeek.showGroup",LeaderboardManager.instance.leaderboardRewards);
        this.leaderBoardGroupManager?.initRewards(LeaderboardManager.instance.leaderboardRewards);
        this.preloadRewardIcons(LeaderboardManager.instance.leaderboardRewards);

        let strWeekContextID:string = LeaderboardManager.instance.getWeekContextID_byWeek(LeaderboardManager.instance.currWeek);
        // console.log("strWeekContextID",strWeekContextID);
        let leaderboardDataInfo: LeaderboardDataInfo = LeaderboardManager.instance.getLeaderBoardDataInfo_byContextID(strWeekContextID);
        // console.log("leaderboardDataInfo",leaderboardDataInfo);
        
        // GetTopPlayers_byLeaderboardID() chỉ thật sự gọi API khi envType==FB — mọi env khác nó
        // return ngay mà KHÔNG bắn PGS_RECEIVE_LISTRANK_LEADERBOARD, khiến nodeLoading kẹt mãi
        // (Dogdoku mặc định TEST_AD, không có backend PGS thật). Chỉ đi nhánh PGS khi thật sự FB.
        if (leaderboardDataInfo != null && localConfig.instance.envType == ENV_TYPE.FB) {
            if (LeaderboardManager.instance.mapLeaderBoard_ItemRankInfos.has(leaderboardDataInfo._id)) {
                this.receiveListRankLeaderboard(LeaderboardManager.instance.mapLeaderBoard_ItemRankInfos.get(leaderboardDataInfo._id));
            } else {
                if (this.nodeLoading) this.nodeLoading.active = true;
                PGSPlayInstantManager.instance?.GetTopPlayers_byLeaderboardID(leaderboardDataInfo._id, leaderboardDataInfo.tournamentId);
            }
        } else {
            if (localConfig.instance.envType == ENV_TYPE.TEST_AD) {
                // Điểm bot đọc từ cache dùng chung trong LeaderboardManager — bot chỉ "chơi thêm"
                // mỗi khi người chơi thắng 1 màn thật (xem LeaderboardManager.addCurrWeekScore),
                // KHÔNG lăn theo số lần mở màn này, để tốc độ leo hạng của bot đồng bộ đúng nhịp
                // chơi thật của người chơi.
                const fakeBotScores = LeaderboardManager.instance?.getFakeBotWeeklyScores() ?? [];
                // Tên + avatar bot đọc từ cache dùng chung trong LeaderboardManager — CỐ ĐỊNH
                // cho tới khi thật sự có bot mới (sang tuần), KHÔNG random lại mỗi lần mở tab
                // (trước đây gọi getRandomName()/getRandomAvatarURL() ngay tại đây MỖI LẦN
                // showGroup() chạy, khiến bảng xếp hạng "đổi người" liên tục dù điểm không đổi).
                const fakeBotIdentities = LeaderboardManager.instance?.getFakeBotWeeklyIdentities() ?? [];

                let arrListLeaderboard_Ranks: ItemRankInfo[] = [];
                for (let i = 0; i < fakeBotScores.length; i++) {
                    // Bot 0 điểm (vùng thấp/luôn-0 lúc reset, xem buildBaselineWeeklyBotScores())
                    // KHÔNG hiện trên bảng xếp hạng — chỉ được thêm vào khi tự ghi được điểm đầu
                    // tiên (rollWeeklyOnlineGrowth/rollWeeklyOfflineGrowth vẫn roll bình thường dù
                    // đang 0 điểm, nên bot sẽ tự "xuất hiện" dần theo thời gian).
                    if (fakeBotScores[i] <= 0) continue;
                    let itemRankInfo: ItemRankInfo = new ItemRankInfo();
                    itemRankInfo.userName = fakeBotIdentities[i]?.userName ?? "";
                    itemRankInfo.avatarType = AVATAR_TYPE.TYPE_LOCAL;
                    itemRankInfo.userScore = fakeBotScores[i];
                    itemRankInfo.avatarURL = fakeBotIdentities[i]?.avatarURL ?? "";
                    itemRankInfo.indexRank = i + 1;
                    // Bot KHÔNG BAO GIỜ được đánh dấu isMyRank — trước đây bot #1 giả làm "tôi"
                    // khiến điểm hiển thị bị khoá cứng ở giá trị tĩnh của bot, không tăng theo
                    // điểm thật dù người chơi thắng bao nhiêu màn. Dòng "tôi" luôn được tạo riêng
                    // bên dưới trong receiveListRankLeaderboard() (nhánh else, dùng
                    // getLeaderboardCurrWeekScore() thật).
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

    receiveListRankLeaderboard(arrListRankInfos:ItemRankInfo[]){
        let myItemRankInfo: ItemRankInfo = null;
        let indeMyRank: number = arrListRankInfos.findIndex(item => item.isMyRank == true);
        if (indeMyRank > -1) {
            myItemRankInfo = arrListRankInfos[indeMyRank];
            if(myItemRankInfo.userScore < LeaderboardManager.instance.getLeaderboardCurrWeekScore()){
                myItemRankInfo.userScore = LeaderboardManager.instance.getLeaderboardCurrWeekScore();
            }
            
        } else {
            // Dòng "tôi" LUÔN được thêm vào, kể cả khi chưa có điểm nào (currWeekScore == 0) — chỉ
            // BOT 0 điểm mới bị ẩn khỏi bảng xếp hạng (xem vòng lặp dựng arrListLeaderboard_Ranks ở
            // showGroup()); thanh "myItem" ghim của người chơi vẫn phải hiện (hiện "--" thay vì số
            // hạng, xem ItemLeaderboardEntryBase.showInfoRank() noPlayDataYet) để họ luôn thấy được
            // vị trí/trạng thái của mình dù chưa chơi màn nào trong giải đấu hiện tại.
            myItemRankInfo = new ItemRankInfo();
            myItemRankInfo.avatarType = AVATAR_TYPE.TYPE_WEB;
            myItemRankInfo.avatarURL = ProfileManager.instance.getAvatarURL();
            myItemRankInfo.idFB = localConfig.instance.playerID;
            myItemRankInfo.indexRank = 100;
            myItemRankInfo.isMyRank = true;
            myItemRankInfo.userName = ProfileManager.instance.getName();
            myItemRankInfo.userScore = LeaderboardManager.instance.getLeaderboardCurrWeekScore();
            arrListRankInfos.push(myItemRankInfo);
        }

        arrListRankInfos.sort((a,b)=>{
            return b.userScore - a.userScore;
        });

        for(let i=0; i< arrListRankInfos.length;i++){
            arrListRankInfos[i].indexRank = i + 1;
        }

        let arrListRankInfosTop3:ItemRankInfo[] = arrListRankInfos.slice(0, 3);
        // "Điều kiện để mở leaderboard là khi avatar và frame đã tải xong và ổn định rồi thì mới
        // mở" (xác nhận từ user) — KHÔNG chỉ hoãn tắt nodeLoading, mà TOP3 lẫn scrollview phải ẩn
        // HẲN (chưa active/chưa hiện ra) suốt lúc đang tải, tránh lộ khung/tên/điểm với avatar
        // trống rồi avatar mới "hiện ra" sau — chỉ bật active cho TẤT CẢ cùng lúc, SAU KHI mọi
        // Promise avatar/frame (TOP3 + scrollview) đã xong (bất kể thành công hay lỗi từng cái).
        const loads: Promise<void>[] = [];
        const topRanksToShow: ItemLeaderboardTop[] = [];
        for (let i = 0; i < this.arrItemLeaderboardTops.length; i++) {
            const top = this.arrItemLeaderboardTops[i];
            if (!top) continue;
            if (arrListRankInfosTop3.length > i) {
                loads.push(top.init(arrListRankInfosTop3[i], 0));
                topRanksToShow.push(top);
            } else {
                top.node.active = false;
            }
        }

        // Hạng 1-3 giờ CHỈ hiện ở TOP3 (arrItemLeaderboardTops ở trên) — bỏ khỏi scrollview để
        // không lặp lại, scrollview chỉ còn hạng 4 trở đi.
        const arrListRankInfoOut3: ItemRankInfo[] = arrListRankInfos.slice(3);

        if (this.leaderBoardGroupManager?.scrollView) this.leaderBoardGroupManager.scrollView.node.active = false;
        loads.push(this.leaderBoardGroupManager?.initRankGroup(arrListRankInfoOut3) ?? Promise.resolve());

        // BUG đã sửa (báo lỗi của user — "icon loading tắt trước khi nội dung hiện ra, có khoảng
        // trống/giật"): dòng "tôi" (myItemLeaderBoard) GHIM RIÊNG, nằm NGOÀI scrollView nên KHÔNG bị
        // ẩn theo scrollView.node.active=false ở trên — initRankGroup() lại tự BẬT active NGAY
        // (đồng bộ) cho dòng này nếu người chơi cần ghim hiện, lộ ra avatar/frame còn trống TRƯỚC cả
        // khi phần còn lại tải xong. Chụp lại kết quả CUỐI CÙNG initRankGroup() vừa quyết định, ẩn
        // tạm, chỉ bật lại ĐÚNG lúc reveal cùng mọi thứ khác.
        const myRow = this.leaderBoardGroupManager?.myItemLeaderBoard ?? null;
        const myRowShouldShow = myRow?.node.active ?? false;
        if (myRow) myRow.node.active = false;

        const token = ++this.loadToken;
        console.log('[DEBUG nodeLoading] bắt đầu đợi', loads.length, 'promise, token=', token, 'lúc', performance.now().toFixed(0));
        Promise.all(loads).then(() => {
            // LOG TẠM ĐỂ DEBUG — xoá sau khi xác định được nguyên nhân thật.
            console.log('[DEBUG nodeLoading] Promise.all RESOLVED, token=', token, 'this.loadToken=', this.loadToken,
                'node hợp lệ=', isValid(this.node, true), 'lúc', performance.now().toFixed(0));
            // Người chơi có thể đã đổi tab/đóng Leaderboard trong lúc chờ — chỉ "mở" nếu đây vẫn là
            // lần mở MỚI NHẤT (tránh 1 lần tải cũ hiện đè lên lần mở sau).
            if (token !== this.loadToken || !isValid(this.node, true)) {
                console.log('[DEBUG nodeLoading] BỊ HUỶ (token lệch hoặc node invalid) — KHÔNG reveal, KHÔNG tắt nodeLoading ở lần này.');
                return;
            }
            // BUG đã sửa (báo lỗi của user — "mất hiệu ứng hiện lên của các node"): TOP3/scrollview
            // được dựng (init()) TỪ LÚC CÒN ẨN để avatar/frame kịp tải trước — nhưng init() cũng tự
            // chạy LUÔN tween "bung ra" (showItem()) ngay lúc đó, nên tween chạy xong ÂM THẦM trong
            // lúc ẩn, tới khi hiện ra thì chỉ snap thẳng về trạng thái cuối, KHÔNG còn hiệu ứng gì
            // nữa. Gọi lại showItem() lần nữa NGAY LÚC hiện ra để tween thật sự chạy trên màn hình.
            for (const top of topRanksToShow) { top.node.active = true; top.showItem(); }
            if (this.leaderBoardGroupManager?.scrollView) this.leaderBoardGroupManager.scrollView.node.active = true;
            if (myRow) myRow.node.active = myRowShouldShow;
            this.leaderBoardGroupManager?.replayEntrance();
            // BUG đã sửa (báo lỗi của user — "icon loading tắt quá sớm"): gọi callback ĐỒNG BỘ
            // (readyCallbacks) ngay tại đây — CÙNG 1 lệnh với lúc nodeLoading tắt — thay vì qua
            // whenReady() (Promise, resolve TỪ BÊN TRONG 1 .then() khác luôn trễ thêm ít nhất 1
            // microtask so với dòng này).
            for (const callback of this.readyCallbacks) callback();
            this.readyCallbacks = [];
            // LOG TẠM ĐỂ DEBUG — xoá sau khi xác định được nguyên nhân thật.
            console.log('[DEBUG nodeLoading] REVEAL xong (TOP3/scrollview/myRow đã active, readyCallbacks đã chạy) — TẮT nodeLoading NGAY BÂY GIỜ, lúc', performance.now().toFixed(0));
            if (this.nodeLoading) this.nodeLoading.active = false;
            this.readyResolve?.();
            this.readyResolve = null;
        });
    }

    setReceiveListRankLeaderboard(strLeaderboardID:string){
        if (!LeaderboardManager.instance) return;
        let strWeekContextID:string = LeaderboardManager.instance.getWeekContextID_byWeek(LeaderboardManager.instance.currWeek);
        // console.log("strWeekContextID",strWeekContextID);
        let leaderboardDataInfo: LeaderboardDataInfo = LeaderboardManager.instance.getLeaderBoardDataInfo_byContextID(strWeekContextID);
        if(leaderboardDataInfo != null && leaderboardDataInfo._id == strLeaderboardID){
            let arrListRankInfos:ItemRankInfo[] = LeaderboardManager.instance.getLeaderboardItemRankInfos_byID(strLeaderboardID);
            this.receiveListRankLeaderboard(arrListRankInfos);
        }
    }

    onTouchInfo(){
        clientEvent.dispatchEvent(Constants.SHOW_LEADERBOARD_INFO_POPUP);
    }

    /** Tải trước (cache) icon các phần thưởng cấu hình cho Weekly — bảng chi tiết thưởng
     * (DetailRewardGroup, mở khi bấm hộp quà ở TOP3 hoặc 3 dòng đầu scrollview) chỉ tải icon
     * NGAY LÚC bấm (ItemRewardBox.loadIconReward, bất đồng bộ) — lần đầu vào game (chưa có gì
     * trong cache MConfigResourceUtils.mapLoadedGameResources) tải chậm, khiến bảng hiện ra
     * TRỐNG (icon chưa kịp load) hoặc đã tự ẩn trước khi icon load xong. Tải trước NGAY LÚC mở
     * tab Leaderboard (sớm hơn, còn nhiều thời gian hơn hẳn so với đợi user bấm) để icon đã có
     * sẵn trong cache trước khi người chơi kịp bấm hộp quà nào. */
    private preloadRewardIcons(rewards: { rewards: { Type: number; SpecificType: number }[] }[]): void {
        if (!rewards) return;
        for (const tier of rewards) {
            if (!tier?.rewards) continue;
            for (const gameResource of tier.rewards) {
                const pathIcon: string = GameResourceConfigManager.instance.getPathIconGameResource(gameResource.Type, gameResource.SpecificType);
                MConfigResourceUtils.getGameResourceSpriteFrame(pathIcon, () => {});
            }
        }
    }
}


