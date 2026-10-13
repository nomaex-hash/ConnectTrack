// @ts-nocheck
import { _decorator, Color, Component, Label, Node, Sprite, SpriteFrame, Tween, Vec3, tween } from 'cc';
import { ItemLeaderboardBase } from './ItemLeaderboardBase';
import { ItemRankInfo } from './ItemRankInfo';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { ProfileManager } from '../profile/ProfileManager';
import { GameResource } from '../datainfo/GameResource';
import { Localization } from '../localization/Localization';
import { L10N } from '../localization/LocalizationKeys';
const { ccclass, property } = _decorator;

@ccclass('ItemLeaderboardEntryBase')
export class ItemLeaderboardEntryBase extends ItemLeaderboardBase {
    @property(Label)
    txtName:Label = null;
    @property(Color)
    colorName_normal:Color = null;

    @property(Color)
    colorName_myPlayer:Color = null;


    @property(Label)
    txtScore:Label = null;

    @property(Color)
    colorOutlineScore_normal:Color = null;

    @property(Color)
    colorOutlineScore_myPlayer:Color = null;

    @property(Label)
    lbTextScore:Label;

    @property(Color)
    colorText_normal:Color = null;

    @property(Color)
    colorText_myPlayer:Color = null;


    @property(Sprite)
    bg:Sprite = null;

    @property(SpriteFrame)
    arrSfBgs:SpriteFrame[] = [];

    @property(Sprite)
    bgScore:Sprite = null;

    @property(SpriteFrame)
    arrSfBgScores:SpriteFrame[] = [];

    @property(Sprite)
    iconRankTop3:Sprite = null;

    @property(SpriteFrame)
    arrSfIconRankTop3:SpriteFrame[] = [];

    @property(Label)
    txtIndexRank:Label = null;

    @property(Color)
    colorOutlineIndexRank_normal:Color = null;

    @property(Color)
    colorOutlineIndexRank_myPlayer:Color = null;

    // @property(Sprite)
    // iconPrizeTop:Sprite = null;

    // @property(SpriteFrame)
    // arrSfIconPrizeTops:SpriteFrame[] = [];




    indexPos:number;

    setIndexPos(_indexPos:number){
        this.indexPos = _indexPos;
    }

    protected onEnable(): void {
        super.onEnable();
        // this.iconPrize.node.on(Constants.CLICK, this.onTouchDetail, this);
    }
    

    protected onDisable(): void {
        super.onDisable();

        // this.iconPrize.node.off(Constants.CLICK, this.onTouchDetail, this);
    }

    init(_itemRankInfo: ItemRankInfo, _timeDelay: number = 0): Promise<void> {
        const loaded = super.init(_itemRankInfo, _timeDelay);
        this.showInfo();

        this.showItem();

        return loaded;
    }

    showInfo(){
        this.showInfoPlayer();
        this.showInfoRank();
    }

    showInfoRank(){
        let indexRank = this.itemRankInfo.indexRank;
        if(this.iconRankTop3) this.iconRankTop3.node.active = false;
        if(this.txtIndexRank) this.txtIndexRank.node.active = false;

        // Dòng "tôi" khi chưa có điểm nào (chưa thắng màn nào trong giải đấu hiện tại — điểm
        // Weekly chỉ TĂNG khi thắng, không bao giờ giảm, nên userScore == 0 nghĩa chắc chắn là
        // "chưa chơi màn nào", không phải "chơi rồi mà được 0 điểm"): hiện "--" thay vì một thứ
        // hạng số cụ thể, vì thứ hạng đó chỉ do sort với bot mà có, không phản ánh gì cả.
        const noPlayDataYet = this.itemRankInfo.isMyRank
            && (this.itemRankInfo.userScore == null || this.itemRankInfo.userScore <= 0);
        if(noPlayDataYet){
            if(this.txtIndexRank){
                this.txtIndexRank.node.active = true;
                this.txtIndexRank.string = `--`;
                this.txtIndexRank.outlineColor = this.colorOutlineIndexRank_myPlayer;
            }
            return;
        }

        this.setDisplayedRank(indexRank);
    }

    /** Đổi RIÊNG số/sprite thứ hạng hiển thị theo `rank`, KHÔNG đụng gì khác của dòng — dùng cho
     * animation leo hạng (LeaderboardPreviewManager đổi dần từng bậc khi hàng "tôi" đi qua). Cùng
     * logic rank<=3 dùng huy chương / còn lại dùng số như showInfoRank(). `animate=true`: sprite
     * huy chương hiện lên kiểu scale nhỏ→lớn mỗi lần ĐỔI (vào top3, hoặc đổi tiếp 3→2→1). */
    setDisplayedRank(rank:number, animate:boolean=false){
        if(this.iconRankTop3) this.iconRankTop3.node.active = false;
        if(this.txtIndexRank) this.txtIndexRank.node.active = false;

        if(rank > 0 && rank <= 3){
            if(this.iconRankTop3){
                this.iconRankTop3.node.active = true;
                this.iconRankTop3.spriteFrame = this.arrSfIconRankTop3[rank - 1];
                if(animate) this.playRankIconPopIn(this.iconRankTop3.node);
            }
        }else if(this.txtIndexRank){
            this.txtIndexRank.node.active = true;
            this.txtIndexRank.string = `${rank}`;

            if(this.itemRankInfo?.isMyRank){
                this.txtIndexRank.outlineColor = this.colorOutlineIndexRank_myPlayer;
            }else{
                this.txtIndexRank.outlineColor = this.colorOutlineIndexRank_normal;
            }
        }
    }

    // CÁC field trang trí (bg/bgScore/txtName/txtScore/lbTextScore) đều guard null — prefab dùng
    // chung cho nhiều biến thể (thường/hộp quà/TOP3...) không phải lúc nào cũng gán đủ hết mọi
    // field trong Inspector (vd bgScore/lbTextScore hiện KHÔNG được gán ở cả 3 prefab row — chưa
    // từng dùng tới), thiếu 1 field trang trí KHÔNG được phép crash trắng cả màn Leaderboard.
    /** Đổi RIÊNG số tim hiển thị ("xN") mà không init lại cả dòng — dùng cho hiệu ứng tim bay vào
     * (LeaderboardPreviewManager) tăng dần số tim từng nhịp. */
    setScoreValue(score:number){
        if(this.txtScore) this.txtScore.string = `x${score}`;
    }

    /** Node đích cho hiệu ứng tim bay vào (chính label số tim). */
    getScoreTargetNode(): Node | null {
        return this.txtScore ? this.txtScore.node : null;
    }

    private playRankIconPopIn(node:Node){
        Tween.stopAllByTarget(node);
        node.setScale(new Vec3(0, 0, 1));
        tween(node).to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    showInfoPlayer(){
        let isMyRank:boolean = this.itemRankInfo.isMyRank;
        // bg là background phân biệt "dòng của tôi" (xanh) với dòng người khác (vàng, mặc định)
        // khi dòng "tôi" rơi vào giữa danh sách cuộn (không phải dòng ghim myItemLeaderBoard) —
        // ĐỪNG xoá field này, chỉ bgScore mới thật sự chưa dùng tới.
        if(this.bg) this.bg.spriteFrame = isMyRank ? this.arrSfBgs[1] : this.arrSfBgs[0];
        if(this.bgScore) this.bgScore.spriteFrame = isMyRank ? this.arrSfBgScores[1] : this.arrSfBgScores[0];
        if(this.txtName) this.txtName.color = isMyRank ? this.colorName_myPlayer : this.colorName_normal;
        if(this.txtScore) this.txtScore.outlineColor = isMyRank ? this.colorOutlineScore_myPlayer : this.colorOutlineScore_normal;
        if(this.lbTextScore) this.lbTextScore.color = isMyRank ? this.colorText_myPlayer : this.colorText_normal;

        if(this.txtName){
            if(isMyRank){
                this.txtName.string = `${ProfileManager.instance.getName()}`;
            }else if(this.itemRankInfo.userName != null && this.itemRankInfo.userName != 'undefined') {
                this.txtName.string = `${this.itemRankInfo.userName}`;
            }
        }

        if(!this.txtScore) return;

        // "???" chỉ còn dùng cho trường hợp THẬT SỰ không có điểm (null/undefined) — trước đây
        // còn yêu cầu userScore > 0, khiến điểm 0 hợp lệ (ví dụ vừa reset test, chưa thắng màn
        // nào) cũng hiện "???" như thể lỗi dữ liệu, dù 0 là giá trị đúng cần hiện ra.
        this.txtScore.string = Localization.get(L10N.leaderboard.unknownScore);
        if(this.itemRankInfo.userScore != null && this.itemRankInfo.userScore >= 0){
            this.txtScore.string = `x${this.itemRankInfo.userScore}`;
        }
    }
}


