// @ts-nocheck
import { _decorator, Button, Component, Label, Node, Sprite } from 'cc';
import { BasePopup } from '../common/BasePopup';
import { localConfig } from '../localConfig';
import { PROFILE_TAB_TYPE, ProfileManager } from './ProfileManager';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

/**
 * Bản rút gọn của ProfilePopup gốc — bỏ HotPotQuestManager/RiseUpManager/PlayerInfoManager
 * (hệ thống event/minigame riêng của MagicSort, Dogdoku không có) nên các label thống kê
 * (weekly win, streak, tournament win) không có dữ liệu để hiển thị — để trống thay vì crash.
 */
@ccclass('ProfilePopup')
export class ProfilePopup extends BasePopup {
    @property(Sprite)
    iconAvatar: Sprite = null;

    @property(Sprite)
    iconFrame: Sprite = null;

    @property(Label)
    txtName: Label = null;

    @property(Label)
    txtLevel: Label = null;

    @property(Label)
    txtLevel_Shadow: Label = null;

    @property(Button)
    btnEdit: Button = null;

    @property({
        type: Node,
        tooltip:
            'Icon xoay (gắn component IconLoading2, cùng loại đã dùng lúc lazy-load Shop/Leaderboard ' +
            'trong HomeTabGroupManager) — hiện trong lúc đang tải sprite avatar/frame (bất đồng bộ, ' +
            'xem showInfo()), tự ẩn khi tải xong (kể cả lỗi).',
    })
    loadingIcon: Node = null;

    /** Số lượt tải sprite (avatar/frame) đang CÒN CHỜ — loadingIcon chỉ ẩn khi về 0 (cả 2 xong). */
    private pendingIconLoads = 0;

    onEnable(): void {
        super.onEnable();
        this.btnEdit?.node.on(Constants.CLICK, this.onTouchEdit, this);
    }

    onDisable(): void {
        super.onDisable();
        this.btnEdit?.node.off(Constants.CLICK, this.onTouchEdit, this);
    }


    showProfilePopup(_cbWhenClose?: Function) {
        this.showPopup(_cbWhenClose);
        if (this.txtLevel && this.txtLevel_Shadow) {
            this.txtLevel.string = this.txtLevel_Shadow.string = `${localConfig.instance.currLevelUnlock}`;
        }
        this.showInfo();
        super.showPopup(_cbWhenClose);
    }

    showInfo(){
        if (!ProfileManager.instance) return;
        if (this.txtName) this.txtName.string = `${ProfileManager.instance.getName()}`;

        this.beginIconLoad();
        let pathAvatar:string = ProfileManager.instance.getPathAvatar();
        MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.AVATAR,pathAvatar, (err, spriteFrame) =>{
            this.endIconLoad();
            if(err){
            }else{
                if(this.iconAvatar == null) return;
                this.iconAvatar.sizeMode = Sprite.SizeMode.CUSTOM;
                this.iconAvatar.spriteFrame = spriteFrame;
            }
        });

        this.beginIconLoad();
        let pathFrame:string = ProfileManager.instance.getPathFrame();
        MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.FRAME,pathFrame, (err, spriteFrame) =>{
            this.endIconLoad();
            if(err){
            }else{
                if(this.iconFrame == null) return;
                this.iconFrame.sizeMode = Sprite.SizeMode.CUSTOM;
                this.iconFrame.spriteFrame = spriteFrame;
            }
        });
    }

    private beginIconLoad(): void {
        this.pendingIconLoads++;
        if (this.loadingIcon) this.loadingIcon.active = true;
    }

    private endIconLoad(): void {
        this.pendingIconLoads = Math.max(0, this.pendingIconLoads - 1);
        if (this.pendingIconLoads === 0 && this.loadingIcon) this.loadingIcon.active = false;
    }

    onTouchEdit(){
        clientEvent.dispatchEvent(Constants.SHOW_PROFILE_EDIT_POPUP,()=>{
            this.showInfo();
            clientEvent.dispatchEvent(Constants.PROFILE_UPDATE);
        });
    }
}
