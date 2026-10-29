// @ts-nocheck
import { _decorator, Button, Component, Label, Node, Sprite, tween, Tween } from 'cc';
import { ProfileDataDetail } from '../datainfo/ProfileDataDetail';
import { PROFILE_TAB_TYPE, ProfileManager } from './ProfileManager';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
import { localConfig } from '../localConfig';
const { ccclass, property } = _decorator;

@ccclass('ItemProfileDetail')
export class ItemProfileDetail extends Component {
    profileDataDetail: ProfileDataDetail = null;
    profileTabType: PROFILE_TAB_TYPE = PROFILE_TAB_TYPE.AVATAR;
    currSelectedID:number = 0;

    @property(Button)
    btnItem: Button = null;

    @property(Node)
    objSelected: Node = null;

    @property(Node)
    objLock: Node = null;

    @property(Node)
    iconLock: Node = null;

    @property(Label)
    txtUnlock: Label = null;

    @property({ type: Node, tooltip: 'Sprite đen mờ phủ lên icon khi khoá (node "notunlock2" trong prefab).' })
    dimOverlayNode: Node = null;

    tweenObjLock:Tween<{}> = null;

    @property(Sprite)
    avatarIcon: Sprite = null;

    @property(Sprite)
    frameIcon: Sprite = null;

    @property(Node)
    frameBackground: Node = null;


    protected onEnable(): void {
        this.btnItem?.node.on(Constants.CLICK, this.onTouchItem, this);
    }

    protected onDisable(): void {
        this.btnItem?.node.off(Constants.CLICK, this.onTouchItem, this);
    }

    initItem(tabType: PROFILE_TAB_TYPE, profileDataDetail: ProfileDataDetail, selectedID:number) {
        this.profileTabType = tabType;
        this.profileDataDetail = profileDataDetail;
        this.currSelectedID = selectedID;

        const isAvatar = tabType === PROFILE_TAB_TYPE.AVATAR;
        if (this.avatarIcon) this.avatarIcon.node.active = isAvatar;
        if (this.frameIcon) this.frameIcon.node.active = tabType === PROFILE_TAB_TYPE.FRAME;
        if (this.frameBackground) this.frameBackground.active = tabType === PROFILE_TAB_TYPE.FRAME;

        if (!ProfileManager.instance) return;

        if(tabType == PROFILE_TAB_TYPE.AVATAR) {
            let pathAvatar:string = ProfileManager.instance.getPathAvatar_byID(this.profileDataDetail.Id);
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.AVATAR,pathAvatar, (err, spriteFrame) =>{
                if(err){
                }else{
                    if(this.avatarIcon == null) return;
                    this.avatarIcon.sizeMode = Sprite.SizeMode.CUSTOM;
                    this.avatarIcon.spriteFrame = spriteFrame;
                }
            });
        }else if(tabType == PROFILE_TAB_TYPE.FRAME) {
            let pathFrame:string = ProfileManager.instance.getPathFrame_byID(this.profileDataDetail.Id);
            MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.FRAME,pathFrame, (err, spriteFrame) =>{
                if(err){
                }else{
                    if(this.frameIcon == null) return;
                    this.frameIcon.sizeMode = Sprite.SizeMode.CUSTOM;
                    this.frameIcon.spriteFrame = spriteFrame;
                }
            });
        }

        this.showInfo(selectedID);

    }

    /** Frame (chỉ Frame, không áp dụng Avatar) khoá theo level — mở dần theo levelRequire trong
     * profileData.json, so với localConfig.instance.currLevelUnlock (đã đồng bộ với tiến trình
     * thật, xem GameManager.pushLeaderboardScore/initSystems). */
    isLocked(): boolean {
        if (this.profileTabType !== PROFILE_TAB_TYPE.FRAME) return false;
        const levelRequire = this.profileDataDetail?.levelRequire ?? 0;
        if (levelRequire <= 0) return false;
        return localConfig.instance.currLevelUnlock < levelRequire;
    }

    showInfo(selectedID:number) {
        if (this.objSelected) this.objSelected.active = false;

        const locked = this.isLocked();
        if (this.objLock) this.objLock.active = locked;
        if (this.iconLock) this.iconLock.active = locked;
        if (this.dimOverlayNode) this.dimOverlayNode.active = locked;
        if (this.txtUnlock) {
            this.txtUnlock.node.active = locked;
            if (locked) this.txtUnlock.string = `Lv.${this.profileDataDetail.levelRequire}`;
        }

        if(!locked && this.profileDataDetail.Id == selectedID) {
            if (this.objSelected) this.objSelected.active = true;
        }
    }

    onTouchItem() {
        if (this.isLocked()) return;
        if(this.profileDataDetail.Id == this.currSelectedID) {

        }else{
            clientEvent.dispatchEvent(Constants.PROFILE_POPUP_SELECT_ITEM, this.profileDataDetail.Id);
        }
    }

    setUpdateSelectedItem(selectedID:number) {
        this.currSelectedID = selectedID;
        this.showInfo(selectedID);
    }

}
