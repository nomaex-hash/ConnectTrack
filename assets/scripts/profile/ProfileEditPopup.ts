// @ts-nocheck
import { _decorator, Button, Component, EditBox, instantiate, Label, Node, Prefab, ScrollView, Sprite } from 'cc';
import { BasePopup } from '../common/BasePopup';
import { clientEvent } from '../framework/clientEvent';
import { Constants } from '../framework/constants';
import { PROFILE_TAB_TYPE, ProfileManager } from './ProfileManager';
import { ItemTabProfile } from './ItemTabProfile';
import { ItemProfileDetail } from './ItemProfileDetail';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
import { PGSPlayInstantManager } from '../common/PGSPlayInstantManager';
import { PopupAnimation } from '../ui/PopupAnimation';
import { localConfig } from '../localConfig';
import { GameConfig } from '../config/GameConfig';
import { Localization } from '../localization/Localization';
import { L10N } from '../localization/LocalizationKeys';
const { ccclass, property } = _decorator;

/** Số khung (Frame) hiện ra khi người chơi CHƯA mở được Leaderboard (chưa thắng xong level
 * GameConfig.leaderboardUnlockLevel) — các khung còn lại tạm thời ẨN HẲN khỏi danh sách (khác
 * với khoá theo level — objLock/dimOverlayNode của ItemProfileDetail — vẫn giữ nguyên, áp dụng
 * cho các khung NẰM TRONG số này). Mở Leaderboard xong thì hiện lại đầy đủ như cũ. */
const FRAME_COUNT_BEFORE_LEADERBOARD_UNLOCK = 4;

/**
 * Avatar/Frame: lưu ngay trong setUpdateSelectedItem() khi bấm 1 ô (Frame khoá theo level thì
 * ItemProfileDetail tự chặn tap, không dispatch PROFILE_POPUP_SELECT_ITEM lên tới đây) — nút Save
 * KHÔNG liên quan tới 2 mục này.
 *
 * Tên: có 2 đường lưu dùng CHUNG commitName() — (1) EditBox tự kết thúc chỉnh sửa (chạm ra
 * ngoài / bấm Done trên bàn phím), xem onNameEditingEnded(), KHÔNG đóng popup; (2) bấm nút Save
 * (onTapSave, node "btnSave" có sẵn trong prefab nhưng trước đây bị ẩn/không wire), commitName()
 * xong mới đóng popup — tên rỗng thì báo lỗi, GIỮ popup mở, không đóng.
 *
 * Hiệu ứng hiện/ẩn: KHÔNG dùng tween scale/opacity có sẵn của BasePopup nữa (isTweenPopup=false),
 * chuyển hẳn sang PopupAnimation (component gắn trực tiếp trên node popup này) để đồng bộ với
 * các popup khác trong game dùng chung 1 kiểu hiệu ứng.
 */
@ccclass('ProfileEditPopup')
export class ProfileEditPopup extends BasePopup {
    @property(Sprite)
    iconAvatar: Sprite = null;

    @property(Sprite)
    iconFrame: Sprite = null;

    @property(EditBox)
    editName: EditBox = null;

    currTab:PROFILE_TAB_TYPE = PROFILE_TAB_TYPE.AVATAR;
    @property(ItemTabProfile)
    arrItemTabProfiles:ItemTabProfile[] = [];

    @property(ScrollView)
    scrollview:ScrollView = null;

    @property(Node)
    contentGroup:Node = null;

    @property(Prefab)
    itemProfilePrefab:Prefab = null;

    arrItemProfiles:ItemProfileDetail[] = [];

    currAvatarSelectedID:number = 0;
    currFrameSelectedID:number = 0;

    defaultName:string = '';

    @property(Button)
    btnEditName: Button = null;

    @property(Sprite)
    bgEditBox:Sprite = null;

    @property({
        type: Node,
        tooltip:
            'Sprite nền ĐỎ riêng — hiện khi tên đang trống/không hợp lệ, ẨN khi hợp lệ. KHÔNG còn ' +
            'tint màu bgEditBox (bgName) nữa — node này nằm ĐÈ lên/dưới bgEditBox tuỳ ý, script chỉ ' +
            'bật/tắt active.',
    })
    bgNameErrorSprite: Node = null;

    @property(Node)
    nodeNotifyValidName:Node = null;

    @property({
        type: Node,
        tooltip:
            'Nút Save — node "btnSave" CÓ SẴN trong prefab (trước đây bị ẩn, không wire). Bấm thì ' +
            'lưu tên đang nhập (commitName) rồi đóng popup; tên rỗng thì báo lỗi, KHÔNG đóng.',
    })
    btnSave: Node = null;

    @property({
        type: Node,
        tooltip:
            'Icon xoay (gắn component IconLoading2, cùng loại đã dùng lúc lazy-load Shop/Leaderboard ' +
            'trong HomeTabGroupManager) — hiện trong lúc đang tải sprite avatar/frame XEM TRƯỚC ở ' +
            'đầu popup (bất đồng bộ, xem showInfo()), tự ẩn khi tải xong (kể cả lỗi). KHÔNG áp dụng ' +
            'cho từng ô trong lưới chọn (ItemProfileDetail) — quá nhiều ô, tự pop-in riêng lẻ như ' +
            'các icon leaderboard khác, không cần loading chung.',
    })
    loadingIcon: Node = null;

    /** Số lượt tải sprite (avatar/frame XEM TRƯỚC ở đầu popup) đang CÒN CHỜ — loadingIcon chỉ ẩn
     * khi về 0 (cả 2 xong). */
    private pendingIconLoads = 0;

    private popupAnimation: PopupAnimation | null = null;
    private resolveAnimation(): PopupAnimation | null {
        if (!this.popupAnimation || !this.popupAnimation.isValid) {
            this.popupAnimation = this.getComponent(PopupAnimation);
        }
        return this.popupAnimation;
    }

    onLoad(): void {
        // Tắt tween scale/opacity gốc của BasePopup — showPopup()/hidePopup() sẽ chạy tức thời,
        // hiệu ứng hiện/ẩn giờ do PopupAnimation đảm nhiệm hoàn toàn (xem showPoup_ShowView_Finished/hidePopup).
        this.isTweenPopup = false;
    }

    onEnable(): void {
        super.onEnable();
        this.btnEditName?.node.on(Constants.CLICK, this.onTouchEditName, this);
        this.editName?.node.on(EditBox.EventType.EDITING_DID_ENDED, this.onNameEditingEnded, this);
        this.btnSave?.on(Constants.CLICK, this.onTapSave, this);
        clientEvent.on(Constants.PROFILE_POPUP_TOUCH_TAB, this.onTouchTabProfile, this);
        clientEvent.on(Constants.PROFILE_POPUP_SELECT_ITEM, this.setUpdateSelectedItem, this);
    }

    onDisable(): void {
        super.onDisable();
        this.btnEditName?.node.off(Constants.CLICK, this.onTouchEditName, this);
        this.editName?.node.off(EditBox.EventType.EDITING_DID_ENDED, this.onNameEditingEnded, this);
        this.btnSave?.off(Constants.CLICK, this.onTapSave, this);
        clientEvent.off(Constants.PROFILE_POPUP_TOUCH_TAB, this.onTouchTabProfile, this);
        clientEvent.off(Constants.PROFILE_POPUP_SELECT_ITEM, this.setUpdateSelectedItem, this);
    }



    showProfilePopup(_cbWhenClose?: Function) {
        if (!ProfileManager.instance || !this.contentGroup || !this.editName) return;
        if (this.nodeNotifyValidName) this.nodeNotifyValidName.active = false;
        if (this.bgNameErrorSprite) this.bgNameErrorSprite.active = false;
        this.defaultName = ProfileManager.instance.getName();
        this.contentGroup.destroyAllChildren();
        this.arrItemProfiles = [];
        super.showPopup(_cbWhenClose);
        this.currTab = PROFILE_TAB_TYPE.AVATAR;
        this.setUpdateTab();
        this.iniInfo();
        this.showInfo();

        // Node btnSave có sẵn trong prefab nhưng trước đây để active=false — bật lại + đặt text
        // theo ngôn ngữ hiện tại mỗi lần mở popup (KHÔNG cần LocalizedLabel — quét thẳng mọi
        // Label con của btnSave, gồm cả label chính lẫn label đổ bóng, giống cách playLabel/
        // hardPlayLabel của MainMenuScreen tự set string bằng code).
        if (this.btnSave) {
            this.btnSave.active = true;
            for (const label of this.btnSave.getComponentsInChildren(Label)) {
                label.string = Localization.get(L10N.common.save);
            }
        }
    }



    iniInfo() {
        if (!ProfileManager.instance || !this.editName) return;
        this.currAvatarSelectedID = ProfileManager.instance.getAvatarSelectedID();
        this.currFrameSelectedID = ProfileManager.instance.getFrameSelectedID();

        this.editName.string = `${ProfileManager.instance.getName()}`;
        if(ProfileManager.instance.getName() == ""){
            if (this.btnClose) this.btnClose.node.active = false;
            this.editName.setFocus();
            if (this.nodeNotifyValidName) this.nodeNotifyValidName.active = true;
        }else{
            if (this.btnClose) this.btnClose.node.active = true;
        }
        this.showGroup();
    }

    setUpdateSelectedItem(selectedID:number){
        if (!ProfileManager.instance) return;
        if(this.currTab == PROFILE_TAB_TYPE.AVATAR) {
            this.currAvatarSelectedID = selectedID;
            for(let i = 0; i < this.arrItemProfiles.length; i++) {
                this.arrItemProfiles[i].setUpdateSelectedItem(selectedID);
            }
            ProfileManager.instance.setAvatar(selectedID);
        }
        else if(this.currTab == PROFILE_TAB_TYPE.FRAME) {
            this.currFrameSelectedID = selectedID;
            for(let i = 0; i < this.arrItemProfiles.length; i++) {
                this.arrItemProfiles[i].setUpdateSelectedItem(selectedID);
            }
            ProfileManager.instance.setFrame(selectedID);
        }

        this.showInfo();
        clientEvent.dispatchEvent(Constants.PROFILE_UPDATE);
        PGSPlayInstantManager.instance?.UpdatePlayerInfo(ProfileManager.instance.getName(), ProfileManager.instance.getAvatarURL());
    }

    onTouchEditName(){
        if (this.nodeNotifyValidName) this.nodeNotifyValidName.active = false;
        if (this.bgNameErrorSprite) this.bgNameErrorSprite.active = false;
        this.editName?.focus();
    }

    /** Lưu tên khi người chơi chạm ra ngoài EditBox / bấm Done trên bàn phím — KHÔNG đóng popup
     * (khác onTapSave). Tên rỗng thì KHÔNG lưu, giữ nguyên tên cũ và báo lỗi. */
    onNameEditingEnded(): void {
        this.commitName();
    }

    /** Bấm nút Save (btnSave): lưu tên đang nhập RỒI đóng popup — tên rỗng thì commitName() báo
     * lỗi và trả về false, GIỮ popup mở để người chơi sửa lại, không đóng. Avatar/Frame không cần
     * xử lý gì thêm ở đây vì đã tự lưu ngay lúc bấm chọn (setUpdateSelectedItem). */
    onTapSave(): void {
        if (!this.commitName()) return;
        this.hidePopup();
    }

    /** Xác thực + lưu tên đang nhập trong EditBox — dùng CHUNG cho onNameEditingEnded() (EditBox
     * tự kết thúc chỉnh sửa) VÀ onTapSave() (bấm nút Save). Trả về true nếu lưu thành công. */
    private commitName(): boolean {
        if (!this.editName || !ProfileManager.instance) return false;
        const name = this.editName.string.trim();
        if (!name) {
            this.editName.string = this.defaultName;
            if (this.bgNameErrorSprite) this.bgNameErrorSprite.active = true;
            if (this.nodeNotifyValidName) this.nodeNotifyValidName.active = true;
            clientEvent.dispatchEvent(Constants.SHOW_NOTIFICATION, "Please update your name to continue!");
            return false;
        }

        if (name != this.defaultName) {
            ProfileManager.instance.setProfileChangeNameCompleted();
        }
        ProfileManager.instance.setName(name);
        this.defaultName = name;
        if (this.nodeNotifyValidName) this.nodeNotifyValidName.active = false;
        if (this.bgNameErrorSprite) this.bgNameErrorSprite.active = false;
        if (this.btnClose) this.btnClose.node.active = true;
        clientEvent.dispatchEvent(Constants.PROFILE_UPDATE);
        PGSPlayInstantManager.instance?.UpdatePlayerInfo(ProfileManager.instance.getName(), ProfileManager.instance.getAvatarURL());
        return true;
    }

    showInfo(){
        if (!ProfileManager.instance) return;

        this.beginIconLoad();
        let pathAvatar:string = ProfileManager.instance.getPathAvatar_byID(this.currAvatarSelectedID);
        MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.AVATAR,pathAvatar, (err, spriteFrame) =>{
            this.endIconLoad();
            if(err){
                console.log(err);
            }else{
                if (this.iconAvatar) {
                    this.iconAvatar.sizeMode = Sprite.SizeMode.CUSTOM;
                    this.iconAvatar.spriteFrame = spriteFrame;
                }
            }
        });

        this.beginIconLoad();
        let pathFrame:string = ProfileManager.instance.getPathFrame_byID(this.currFrameSelectedID);
        MConfigResourceUtils.getProfileSpriteFrame(PROFILE_TAB_TYPE.FRAME,pathFrame, (err, spriteFrame) =>{
            this.endIconLoad();
            if(err){
                console.log(err);
            }else{
                if (this.iconFrame) {
                    this.iconFrame.sizeMode = Sprite.SizeMode.CUSTOM;
                    this.iconFrame.spriteFrame = spriteFrame;
                }
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

    onTouchTabProfile(profileTabType: PROFILE_TAB_TYPE) {
        if (this.currTab == profileTabType) return;
        this.currTab = profileTabType;
        this.setUpdateTab();

        this.showGroup();
    }

    setUpdateTab() {
        for (let i = 0; i < this.arrItemTabProfiles.length; i++) {
            if (this.arrItemTabProfiles[i].profileTabType == this.currTab) {
                this.arrItemTabProfiles[i].setItemON();
            } else {
                this.arrItemTabProfiles[i].setItemOFF();
            }
        }
    }

    showGroup(){
        if (!ProfileManager.instance || !this.contentGroup || !this.itemProfilePrefab) return;
        if(this.currTab == PROFILE_TAB_TYPE.AVATAR){
            this.contentGroup.destroyAllChildren();
            this.arrItemProfiles = [];
            for(let i = 0; i < ProfileManager.instance.avatarDataDetails.length; i++) {
                let item:Node = instantiate(this.itemProfilePrefab);
                let itemProfile:ItemProfileDetail = item.getComponent(ItemProfileDetail);
                item.setParent(this.contentGroup);
                if (!itemProfile) continue;
                this.arrItemProfiles.push(itemProfile);
                itemProfile.initItem(PROFILE_TAB_TYPE.AVATAR, ProfileManager.instance.avatarDataDetails[i], this.currAvatarSelectedID);
            }
        }else if(this.currTab == PROFILE_TAB_TYPE.FRAME){
            this.contentGroup.destroyAllChildren();
            this.arrItemProfiles = [];
            const frameCount = this.isLeaderboardUnlocked()
                ? ProfileManager.instance.frameDataDetails.length
                : Math.min(FRAME_COUNT_BEFORE_LEADERBOARD_UNLOCK, ProfileManager.instance.frameDataDetails.length);
            for(let i = 0; i < frameCount; i++) {
                let item:Node = instantiate(this.itemProfilePrefab);
                let itemProfile:ItemProfileDetail = item.getComponent(ItemProfileDetail);
                item.setParent(this.contentGroup);
                if (!itemProfile) continue;
                this.arrItemProfiles.push(itemProfile);
                itemProfile.initItem(PROFILE_TAB_TYPE.FRAME, ProfileManager.instance.frameDataDetails[i], this.currFrameSelectedID);
            }
        }
    }

    /** true khi đã THẮNG XONG level GameConfig.leaderboardUnlockLevel — cùng nguồn dữ liệu
     * (localConfig.instance.currLevelUnlock) mà ItemProfileDetail.isLocked() đang dùng để khoá
     * khung theo level, giữ nhất quán trong cùng module Profile (hệ cũ, không qua ProgressionHolder). */
    private isLeaderboardUnlocked(): boolean {
        return localConfig.instance.currLevelUnlock >= GameConfig.leaderboardUnlockLevel;
    }

    showPoup_ShowView_Finished(): void {
        super.showPoup_ShowView_Finished();
        this.resolveAnimation()?.playEnter();
    }

    /** Ghi đè hoàn toàn hidePopup() của BasePopup — không tween scale/opacity kiểu cũ nữa, đợi
     * PopupAnimation chạy xong hiệu ứng biến mất rồi mới thực sự đóng popup (nút Close cũng đi
     * qua đường này vì BasePopup.touchClose() gọi thẳng this.hidePopup()). */
    hidePopup(): void {
        const anim = this.resolveAnimation();
        if (!anim) {
            super.hidePopup();
            return;
        }
        if (this.lockGroup) this.lockGroup.active = true;
        anim.playExit(() => this.hidePopup_Finished());
    }

    hidePopup_Finished(): void {
        super.hidePopup_Finished();
        if (this.cbWhenClose) {
            this.cbWhenClose();
        }
    }
}
