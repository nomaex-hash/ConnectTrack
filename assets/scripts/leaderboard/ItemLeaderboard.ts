// @ts-nocheck
import { _decorator, Button, Color, Component, instantiate, Label, Node, Prefab, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { PROFILE_TAB_TYPE, ProfileManager } from '../profile/ProfileManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
import Utils from '../core/utils/Utils';
import { DetailRewardGroup } from '../common/DetailRewardGroup';
import { Constants, TAB_TYPE } from '../framework/constants';
import { GameResource } from '../datainfo/GameResource';
import { LeaderboardManager } from './LeaderboardManager';
import { TournamentManager } from '../tournaments/TournamentManager';
import { ItemSlotReward } from '../common/ItemSlotReward';
const { ccclass, property } = _decorator;


@ccclass('ItemLeaderboard')
export class ItemLeaderboard extends Component {
    itemRankInfo:ItemRankInfo;

    @property({type:TAB_TYPE})
    tabType:TAB_TYPE = TAB_TYPE.LEADERBOARD;

    @property(Node)
    nodeGroup:Node = null;

    @property(UIOpacity)
    nodeGroupOpacity:UIOpacity = null;

    tweenGroup:Tween<{}> = null;
    tweenGroupOpacity:Tween<{}> = null;

    @property(Sprite)
    iconAvatar:Sprite = null;

    @property(Sprite)
    iconFrame:Sprite = null;

    @property(Sprite)
    iconRank:Sprite = null;

    @property(Node)
    objRank: Node = null;

    @property({ type: Sprite, tooltip: 'Node ngôi sao — đổi ảnh theo normal/myItem.' })
    iconStar: Sprite = null;

    @property({ type: SpriteFrame, tooltip: 'Sao NÂU — dòng người chơi khác (normal).' })
    sfStarNormal: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Sao XANH — dòng của chính người chơi (myItem).' })
    sfStarMine: SpriteFrame = null;

    @property(Node)
    myBgItemNode:Node = null;

    @property(Node)
    myBgRankNode:Node = null;

    @property(Node)
    myBgScoreNode:Node = null;

    @property(Label)
    txtMyName:Label = null;
    // yours
    @property(Node)
    yourBgItemNode:Node = null;

    @property(Node)
    yourBgRankNode:Node = null;

    @property(Node)
    yourBgScoreNode:Node = null;


    @property(Label)
    txtLevel:Label = null;
    @property(SpriteFrame)
    arrSfFrameRanks:SpriteFrame[] = [];

    @property(Label)
    txtName:Label = null;

    @property(Label)
    txtRank:Label = null;

    @property(Label)
    txtScore:Label = null;

    indexPos:number;

    @property(Node)
    groupGift:Node = null;
    @property(Button)
    g1:Button = null;
    @property(Button)
    g2:Button = null;
    @property(Button)
    g3:Button = null;

    @property(DetailRewardGroup)
    detailRewardGroup:DetailRewardGroup = null;

    isDetailRewardShowing: boolean = false;
    targetLayer: Node = null;
    protected onEnable(): void {
        if(this.g1){
            this.g1.node.on(Constants.CLICK, this.onTouchDetail, this);
        }
        if(this.g2){
            this.g2.node.on(Constants.CLICK, this.onTouchDetail, this);
        }
        if(this.g3){
            this.g3.node.on(Constants.CLICK, this.onTouchDetail, this);
        }
    }

    protected onDisable(): void {
        if(this.g1){
            this.g1.node.off(Constants.CLICK, this.onTouchDetail, this);
        }
        if(this.g2){
            this.g2.node.off(Constants.CLICK, this.onTouchDetail, this);
        }
        if(this.g3){
            this.g3.node.off(Constants.CLICK, this.onTouchDetail, this);
        }

        this.hideDetailReward();
    }

    setTargetLayer(layer: Node): void {
        this.targetLayer = layer;
    }

    setRewardsData(rewards: GameResource[]): void {
        this.rewardsData = rewards;
    }

    onTouchDetail(){
        if(!this.detailRewardGroup) {
            console.warn("");
            return;
        }
        if(this.detailRewardGroup.node.parent !== this.targetLayer) {
            this.detailRewardGroup.node.setParent(this.targetLayer);
        }
        this.isDetailRewardShowing = true;
        this.detailRewardGroup.node.active = true;
        // this.detailRewardGroup.initGroup(this.rewardsData);
        this.detailRewardGroup.showGroup();
        this.calculateAndSetDetailRewardPosition();
    }

    calculateAndSetDetailRewardPosition(): void {
        if(!this.detailRewardGroup || !this.groupGift || !this.targetLayer) {
            return;
        }
        
        let worldPos = this.groupGift.getWorldPosition();
        
        worldPos.y += 20;
        
        let localPos = new Vec3();
        this.targetLayer.getComponent(UITransform).convertToNodeSpaceAR(worldPos, localPos);
        
        this.detailRewardGroup.node.setPosition(localPos);
    }

    hideDetailReward(): void {
        if(this.detailRewardGroup && this.isDetailRewardShowing) {
            this.isDetailRewardShowing = false;
        
            this.detailRewardGroup.hideGroup();
        }
    }

    setIndexPos(_indexPos:number){
        this.indexPos = _indexPos;
    }

     timeDelayShow:number = 0;
    /** Trả về Promise xong khi avatar+frame đã tải xong (hoặc lỗi) — dùng để
     * LeaderBoardGroupManager/LeaderboardGroupWeek gộp (Promise.all) biết lúc nào TOÀN BỘ hàng
     * trong scrollview đã có avatar/frame, mới tắt nodeLoading (xác nhận từ user). */
    init(_itemRankInfo: ItemRankInfo, _timeDelay: number = 0): Promise<void> {
        this.timeDelayShow = _timeDelay;
        this.itemRankInfo = _itemRankInfo;

        const loaded = this.loadAvatar();

        if (this.itemRankInfo.userName != null && this.itemRankInfo.userName != 'undefined') {
            if(this.txtName) {
                this.txtName.string = `${this.itemRankInfo.userName}`;
            }
            if(this.txtMyName) this.txtMyName.string = `${this.itemRankInfo.userName}`;
        }
        if (this.itemRankInfo.isMyRank) {
            if(this.txtName) this.txtName.string = `${ProfileManager.instance.getName()}`;
            if(this.txtMyName) this.txtMyName.string = `${ProfileManager.instance.getName()}`;
            if(this.myBgItemNode) this.myBgItemNode.active = true;
            if(this.myBgRankNode) this.myBgRankNode.active = true;
            if(this.myBgScoreNode) this.myBgScoreNode.active = true;

            if(this.yourBgItemNode) this.yourBgItemNode.active = false;
            if(this.yourBgRankNode) this.yourBgRankNode.active = false;
            if(this.yourBgScoreNode) this.yourBgScoreNode.active = false;
            if(this.txtRank) this.txtRank.outlineColor = new Color(0, 72, 25, 255);
            if(this.txtLevel) this.txtLevel.color = new Color(4, 95, 19, 255);
            if(this.txtScore) this.txtScore.color = new Color(0, 61, 2, 255);
            if(this.txtMyName) this.txtMyName.node.active = true;
            if(this.txtName)this.txtName.node.active = false;
            if(this.tabType === TAB_TYPE.TOURNAMENT){
                if(this.txtName) this.txtName.node.active = true;
                if(this.txtMyName) this.txtMyName.node.active = true;
            }
        } else{
            if(this.myBgItemNode) this.myBgItemNode.active = false;
            if(this.myBgRankNode) this.myBgRankNode.active = false;
            if(this.myBgScoreNode) this.myBgScoreNode.active = false;

            if(this.yourBgItemNode) this.yourBgItemNode.active = true;
            if(this.yourBgRankNode) this.yourBgRankNode.active = true;
            if(this.yourBgScoreNode) this.yourBgScoreNode.active = true;
            if(this.txtRank) this.txtRank.outlineColor = new Color(112, 63, 0, 255);
            if(this.txtLevel) this.txtLevel.color = new Color(154, 77, 40, 255);
            if(this.txtScore) this.txtScore.color = new Color(103, 56, 2, 255);
            if(this.txtMyName) this.txtMyName.node.active = false;
            if(this.txtName) this.txtName.node.active = true;
            if(this.tabType === TAB_TYPE.TOURNAMENT){
                if(this.txtName) this.txtName.node.active = true;
                if(this.txtMyName) this.txtMyName.node.active = true;
            }
        }
        this.showStar();
        if(this.itemRankInfo.indexRank <= 3){
            if(this.tabType === TAB_TYPE.TOURNAMENT) {
                this.setRewardsData(TournamentManager.instance.tournamentRewards[this.itemRankInfo.indexRank - 1].rewards);
            } else {
                this.setRewardsData(LeaderboardManager.instance.leaderboardRewards[this.itemRankInfo.indexRank - 1].rewards);
            }
            if(this.bgRewards) this.bgRewards.width = this.rewardsData.length * 90 + 20;
            this.initRewards(this.rewardsData);
        }

        if (this.itemRankInfo.indexRank >= 100) {
            if(this.txtRank)this.txtRank.string = `99+`;
        } else {
            if(this.txtRank) this.txtRank.string = `${this.itemRankInfo.indexRank}`;
        }
        this.showScore();
        this.showIconRank();

        this.showItem();

        return loaded;
    }

    initRewards(rewards: GameResource[]): void {
        if(!this.itemSlotRewardPrefab || !this.contentRewards) return;
        this.contentRewards.removeAllChildren();
        for(let i = 0; i < rewards.length; i++) {
            const gameResource = rewards[i];
            const item = instantiate(this.itemSlotRewardPrefab);
            let itemSlotReward:ItemSlotReward = item.getComponent(ItemSlotReward);
            itemSlotReward.initItemSlotReward(gameResource);
            item.setParent(this.contentRewards);
        }
    }


    showStar(): void {
        if (!this.iconStar) return;
        const indexRank = this.itemRankInfo?.indexRank ?? 0;
        if (indexRank > 0 && indexRank <= 3) {
            this.iconStar.node.active = false;
            return;
        }
        this.iconStar.node.active = true;
        const frame = this.itemRankInfo.isMyRank ? this.sfStarMine : this.sfStarNormal;
        if (frame) this.iconStar.spriteFrame = frame;
    }

    showScore(){
        if(this.txtScore) this.txtScore.string = `${this.itemRankInfo.userScore}`;
    }

    showIconRank(){
        if (this.itemRankInfo.indexRank <= 3) {
            if(this.iconRank && this.iconRank.node){
                this.iconRank.node.active = true;
                this.iconRank.spriteFrame = this.arrSfFrameRanks[this.itemRankInfo.indexRank - 1];
            }
            if(this.objRank){
                this.objRank.active = false;
            }
            if(this.groupGift){
                this.groupGift.active = true;
                this.g1.node.active = false;
                this.g2.node.active = false;
                this.g3.node.active = false;
                this.g1.node.active = this.itemRankInfo.indexRank === 1;
                this.g2.node.active = this.itemRankInfo.indexRank === 2;
                this.g3.node.active = this.itemRankInfo.indexRank === 3;
            }
        }else{
            if(this.iconRank && this.iconRank.node)this.iconRank.node.active = false;
            if(this.objRank){
                this.objRank.active = true;
            }
            if(this.groupGift){
                this.groupGift.active = false;
            }
        }
    }


    loadAvatar(): Promise<void> {
        let pathAvatar:string = "";
        let pathFrame:string = "";
        if(this.itemRankInfo.isMyRank){
            pathAvatar = ProfileManager.instance.getPathAvatar();
            pathFrame = ProfileManager.instance.getPathFrame();
        }else{
            let strAvatarURL:string = this.itemRankInfo.avatarURL;
            if(strAvatarURL.length == 0 || strAvatarURL.indexOf("_") == -1){
                strAvatarURL = ProfileManager.instance.getRandomAvatarURL();
            }

            let strAvatar = strAvatarURL.split("_")[0];
            let strFrame = strAvatarURL.split("_")[1];
           pathAvatar = ProfileManager.instance.getPathAvatar_byID(parseInt(strAvatar));
           pathFrame  = ProfileManager.instance.getPathFrame_byID(parseInt(strFrame));
        }

        if(this.iconAvatar) this.iconAvatar.spriteFrame = null;
        if(this.iconFrame) this.iconFrame.spriteFrame = null;

        const avatarLoaded = new Promise<void>((resolve) => {
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.AVATAR,pathAvatar, (err, spriteFrame) =>{
                if(err){
                    console.log(err);
                }else{
                    // Guard .node (KHÔNG dùng .isValid — xem giải thích chi tiết ở
                    // ItemLeaderboardBase.loadAvatar(), cùng 1 lỗi race condition) — item có thể đã bị
                    // destroy/recycle CÙNG FRAME trước khi callback load ảnh bất đồng bộ này tới.
                    if(this.iconAvatar && this.iconAvatar.node) this.iconAvatar.spriteFrame = spriteFrame;
                }
                resolve(); // Luôn resolve kể cả lỗi — 1 avatar lỗi không được treo cả Promise.all().
            });
        });

        const frameLoaded = new Promise<void>((resolve) => {
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.FRAME,pathFrame, (err, spriteFrame) =>{
                if(err){
                    console.log(err);
                }else{
                    if(this.iconFrame && this.iconFrame.node) this.iconFrame.spriteFrame = spriteFrame;
                }
                resolve();
            });
        });

        return Promise.all([avatarLoaded, frameLoaded]).then(() => {});
    }

    showItem(){
        if(this.tweenGroup != null){
            this.tweenGroup.stop();
            this.tweenGroup = null;
        }
        if(this.tweenGroupOpacity != null){
            this.tweenGroupOpacity.stop();
            this.tweenGroupOpacity = null;
        }

        const targetScale = this.itemRankInfo?.isMyRank ? 1.026 : 1;
        this.nodeGroupOpacity.opacity = 0;
        this.nodeGroup.active = true;
        this.nodeGroup.setScale(new Vec3(0.8,0.8,1));
        this.tweenGroup = tween(this.nodeGroup).delay(this.timeDelayShow).to(0.3,{scale:new Vec3(targetScale,targetScale,1)},{easing:'quadOut',onComplete:()=>{}}).start();
        this.tweenGroupOpacity = tween(this.nodeGroupOpacity).delay(this.timeDelayShow).to(0.3,{opacity:255},{easing:'linear',onComplete:()=>{}}).start();
    }

    getDetailRewardGroup():DetailRewardGroup{
        return this.detailRewardGroup;
    }
    
    getWorldPositionOfRewardButton():Vec3{
        return this.groupGift.getWorldPosition();
    }
}


