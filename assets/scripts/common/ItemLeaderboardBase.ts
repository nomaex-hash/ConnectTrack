// @ts-nocheck
import { _decorator, Component, Label, Node, Sprite, SpriteFrame, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { ItemRankInfo } from './ItemRankInfo';
import { PROFILE_TAB_TYPE, ProfileManager } from '../profile/ProfileManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

@ccclass('ItemLeaderboardBase')
export class ItemLeaderboardBase extends Component {
    itemRankInfo:ItemRankInfo;

    @property(Node)
    groupAll: Node = null;

    @property({ type: Sprite, tooltip: 'Node ngôi sao — đổi ảnh theo normal/myItem. Đặt ở base để mọi item leaderboard (Top/Entry/Normal/Reward) dùng chung.' })
    iconStar: Sprite = null;

    @property({ type: SpriteFrame, tooltip: 'Sao NÂU — dòng người chơi khác (normal).' })
    sfStarNormal: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Sao XANH — dòng của chính người chơi (myItem).' })
    sfStarMine: SpriteFrame = null;

    @property(UIOpacity)
    groupAllOpacity: UIOpacity = null;

    tweenGroup: Tween<{}> = null;
    tweenGroupOpacity: Tween<{}> = null;

    @property(Sprite)
    iconAvatar:Sprite = null;

    @property(Sprite)
    iconFrame:Sprite = null;

    @property(Label)
    txtName:Label = null;

    timeDelayShow:number = 0;
    /** Trả về Promise xong khi avatar+frame đã tải xong (hoặc lỗi — không bao giờ reject, để
     * Promise.all() gộp nhiều item không bị treo mãi vì 1 item lỗi). Dùng để LeaderboardGroupWeek
     * biết lúc nào mọi avatar/frame đã sẵn sàng, mới tắt nodeLoading + "mở" bảng xếp hạng (xác
     * nhận từ user: lần đầu mở leaderboard phải đợi avatar/frame xong, nodeLoading quay trong lúc
     * chờ). */
    init(_itemRankInfo: ItemRankInfo, _timeDelay: number = 0): Promise<void> {
        this.itemRankInfo = _itemRankInfo;

        this.timeDelayShow = _timeDelay;
        const loaded = this.loadAvatar();
        this.showStar();
        return loaded;
    }

    /** Đổi sprite ngôi sao theo dòng "tôi" (xanh) hay người chơi khác (nâu) — dùng chung cho mọi
     * lớp con (ItemLeaderboardTop, ItemLeaderboardEntryBase/Normal/Reward). Top 3 (hạng 1-3) đã
     * có icon huy chương riêng (iconRankTop3) — không hiện ngôi sao đè lên, chỉ hiện từ hạng 4. */
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

    resetItem(){
        this.txtName.string = ``;
        this.iconAvatar.spriteFrame = null;
        this.iconFrame.spriteFrame = null;
    }

    protected onEnable(): void {
        
    }

    protected onDisable(): void {
        
    }

    loadAvatar(): Promise<void> {
        let pathAvatar: string = "";
        let pathFrame: string = "";
        if (this.itemRankInfo.isMyRank) {
            pathAvatar = ProfileManager.instance.getPathAvatar();
            pathFrame = ProfileManager.instance.getPathFrame();
        } else {
            let strAvatarURL: string = this.itemRankInfo.avatarURL;
            if (strAvatarURL.length == 0 || strAvatarURL.indexOf("_") == -1) {
                strAvatarURL = ProfileManager.instance.getRandomAvatarURL();
            }

            let strAvatar = strAvatarURL.split("_")[0];
            let strFrame = strAvatarURL.split("_")[1];
            pathAvatar = ProfileManager.instance.getPathAvatar_byID(parseInt(strAvatar));
            pathFrame = ProfileManager.instance.getPathFrame_byID(parseInt(strFrame));
        }

        if (this.iconAvatar) this.iconAvatar.spriteFrame = null;
        if (this.iconFrame) this.iconFrame.spriteFrame = null;

        // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân avatar/frame không hiện cho 1 số bot
        // (tên vẫn hiện đúng, chỉ riêng ảnh không tải được — nghi ngờ avatarURL/pathAvatar/pathFrame sai).
        console.log('[ItemLeaderboardBase.loadAvatar] userName=', this.itemRankInfo.userName, 'isMyRank=', this.itemRankInfo.isMyRank, 'avatarURL=', this.itemRankInfo.avatarURL, 'pathAvatar=', pathAvatar, 'pathFrame=', pathFrame);

        const avatarLoaded = new Promise<void>((resolve) => {
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.AVATAR, pathAvatar, (err, spriteFrame) => {
                if (err) {
                    console.log('[ItemLeaderboardBase.loadAvatar] LỖI tải AVATAR userName=', this.itemRankInfo.userName, 'pathAvatar=', pathAvatar, 'err=', err);
                } else {
                    // Guard .node (KHÔNG dùng .isValid — .isValid chỉ false SAU KHI destroy xử lý
                    // xong cuối frame; item có thể vừa bị destroy/recycle CÙNG FRAME (đổi tab,
                    // resetRankGroup destroyAllChildren...) NGAY TRƯỚC KHI callback load ảnh bất đồng
                    // bộ này chạy tới — lúc đó .isValid vẫn còn true nhưng .node đã bị gỡ, gán
                    // spriteFrame sẽ crash ("_uiProps" null) vì code bên trong đọc this.node._uiProps).
                    if (this.iconAvatar && this.iconAvatar.node) this.iconAvatar.spriteFrame = spriteFrame;
                }
                resolve(); // Luôn resolve kể cả lỗi — 1 avatar lỗi không được treo cả Promise.all().
            });
        });

        const frameLoaded = new Promise<void>((resolve) => {
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.FRAME, pathFrame, (err, spriteFrame) => {
                if (err) {
                    console.log('[ItemLeaderboardBase.loadAvatar] LỖI tải FRAME userName=', this.itemRankInfo.userName, 'pathFrame=', pathFrame, 'err=', err);
                } else {
                    if (this.iconFrame && this.iconFrame.node) this.iconFrame.spriteFrame = spriteFrame;
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
        // Hàng của "tôi" to hơn 1 chút (1.05x) so với hàng bình thường (1x) để nổi bật giữa danh
        // sách — chỉ đổi scale ĐÍCH của tween, không đổi cách hiện/animation.
        const targetScale = this.itemRankInfo?.isMyRank ? 1.026 : 1;
        this.groupAllOpacity.opacity = 0;
        this.groupAll.active = true;
        this.groupAll.setScale(new Vec3(0.8,0.8,0.8));
        this.tweenGroup = tween(this.groupAll).delay(this.timeDelayShow).to(0.3,{scale:new Vec3(targetScale,targetScale,1)},{easing:'quadOut',onComplete:()=>{}}).start();
        this.tweenGroupOpacity = tween(this.groupAllOpacity).delay(this.timeDelayShow).to(0.3,{opacity:255},{easing:'linear',onComplete:()=>{}}).start();
    }
}


