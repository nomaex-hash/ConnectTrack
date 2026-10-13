// @ts-nocheck
import { _decorator, Button, Component, Node, Sprite } from 'cc';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { PROFILE_TAB_TYPE, ProfileManager } from './ProfileManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

@ccclass('ButtonProfileManager')
export class ButtonProfileManager extends Component {
    @property(Sprite)
    iconAvatar: Sprite = null;

    @property(Sprite)
    iconFrame: Sprite = null;

    @property(Button)
    btnProfile: Button = null;

    protected onEnable(): void {
        this.btnProfile?.node.on(Constants.CLICK, this.showProfilePopup, this);
        clientEvent.on(Constants.PROFILE_UPDATE, this.setProfileUpdate, this);
        this.showInfo();
    }

    protected onDisable(): void {
        this.btnProfile?.node.off(Constants.CLICK, this.showProfilePopup, this);
        clientEvent.off(Constants.PROFILE_UPDATE, this.setProfileUpdate, this);
    }

    // Theo yêu cầu: bấm nút Profile vào thẳng ProfileEditPopup, bỏ qua ProfilePopup (màn xem/stats).
    showProfilePopup() {
        clientEvent.dispatchEvent(Constants.SHOW_PROFILE_EDIT_POPUP);
    }

    showInfo(){
        if (!ProfileManager.instance) return;
        let pathAvatar:string = ProfileManager.instance.getPathAvatar();
        MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.AVATAR,pathAvatar, (err, spriteFrame) => {
            if(err){
                console.log(err);
            }else{
                if(this.iconAvatar == null) return;
                this.iconAvatar.sizeMode = Sprite.SizeMode.CUSTOM;
                this.iconAvatar.spriteFrame = spriteFrame;
            }
        });
        let pathFrame:string = ProfileManager.instance.getPathFrame();
        MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.FRAME,pathFrame, (err, spriteFrame) => {
            if(err){
                console.log(err);
            }else{
                if(this.iconFrame == null) return;
                this.iconFrame.sizeMode = Sprite.SizeMode.CUSTOM;
                this.iconFrame.spriteFrame = spriteFrame;
            }
        });
    }

    setProfileUpdate() {
        this.showInfo();
    }

}
