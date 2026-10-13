// @ts-nocheck
import { _decorator, BlockInputEvents, Component, instantiate, isValid, Node, Prefab, UITransform, view } from 'cc';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { ProfilePopup } from './ProfilePopup';
import { ProfileEditPopup } from './ProfileEditPopup';
import { ProfileManager, PROFILE_TAB_TYPE } from './ProfileManager';
import { MConfigResourceUtils } from '../framework/MConfigResourceUtils';
const { ccclass, property } = _decorator;

/**
 * Lắng nghe SHOW_PROFILE_POPUP / SHOW_PROFILE_EDIT_POPUP (bắn từ ButtonProfileManager / ProfilePopup)
 * và hiện popup tương ứng. Cùng mẫu với RewardReceivePopupHolder — bản gốc việc này nằm trong
 * HomeSceneManager.ts (không copy sang Dogdoku), đây là bản rút gọn chỉ làm đúng việc này.
 */
@ccclass('ProfilePopupHolder')
export class ProfilePopupHolder extends Component {
    @property(Prefab)
    profilePopupPrefab: Prefab = null;

    @property(Prefab)
    profileEditPopupPrefab: Prefab = null;

    @property(Node)
    parentPopup: Node = null;

    private profilePopup: ProfilePopup = null;
    private profileEditPopup: ProfileEditPopup = null;
    private pendingOpen: object | null = null;
    private loadingLayer: Node | null = null;

    private clearLoading(): void {
        if (isValid(this.loadingLayer, true)) {
            this.loadingLayer.active = false;
            this.loadingLayer.destroy();
        }
        this.loadingLayer = null;
    }

    private showLoading(): void {
        const template = this.profileEditPopupPrefab?.data.getComponent(ProfileEditPopup)?.loadingIcon;
        if (!template) throw new Error('ProfileEditPopup chưa gán loadingIcon.');
        const layer = new Node('ProfileLoadingOverlay');
        this.loadingLayer = layer;
        layer.layer = this.parent.layer;
        layer.setParent(this.parent);
        layer.setSiblingIndex(-1);
        const size = view.getVisibleSize();
        layer.addComponent(UITransform).setContentSize(size.width * 2, size.height * 2);
        layer.addComponent(BlockInputEvents);
        const spinner = instantiate(template);
        spinner.setParent(layer);
        spinner.setPosition(0, 0, 0);
        spinner.active = true;
    }

    protected onEnable(): void {
        clientEvent.on(Constants.SHOW_PROFILE_POPUP, this.showProfilePopup, this);
        clientEvent.on(Constants.SHOW_PROFILE_EDIT_POPUP, this.showProfileEditPopup, this);
    }

    protected onDisable(): void {
        this.pendingOpen = null;
        this.clearLoading();
        clientEvent.off(Constants.SHOW_PROFILE_POPUP, this.showProfilePopup, this);
        clientEvent.off(Constants.SHOW_PROFILE_EDIT_POPUP, this.showProfileEditPopup, this);
    }

    private get parent(): Node {
        return this.parentPopup ?? this.node;
    }

    showProfilePopup(callback?: Function): void {
        if (!this.profilePopupPrefab) {
            console.warn('[ProfilePopupHolder] Chưa gán profilePopupPrefab.');
            return;
        }
        if (this.profilePopup) {
            this.profilePopup.node.setSiblingIndex(999);
            this.profilePopup.showProfilePopup(callback);
            return;
        }
        const node = instantiate(this.profilePopupPrefab);
        node.setParent(this.parent);
        node.setSiblingIndex(999);
        this.profilePopup = node.getComponent(ProfilePopup);
        if (!this.profilePopup) {
            console.warn('[ProfilePopupHolder] Prefab thiếu component ProfilePopup.');
            return;
        }
        this.profilePopup.showProfilePopup(callback);
    }

    async showProfileEditPopup(callback?: Function): Promise<void> {
        if (this.pendingOpen) return;
        const ticket = {};
        this.pendingOpen = ticket;
        try {
            const manager = ProfileManager.instance;
            if (!manager || !this.profileEditPopupPrefab) throw new Error('Profile chưa sẵn sàng.');
            const assets = [
                ...manager.avatarDataDetails.map(entry => ({ type: PROFILE_TAB_TYPE.AVATAR, path: manager.getPathAvatar_byID(entry.Id), cache: MConfigResourceUtils.mapLoadedAvatars })),
                ...manager.frameDataDetails.map(entry => ({ type: PROFILE_TAB_TYPE.FRAME, path: manager.getPathFrame_byID(entry.Id), cache: MConfigResourceUtils.mapLoadedFrames })),
            ];
            const missing = assets.filter(asset => !isValid(asset.cache.get(asset.path), true));
            if (missing.length) {
                this.showLoading();
                await Promise.all(missing.map(asset => new Promise<void>((resolve, reject) => {
                    asset.cache.delete(asset.path);
                    MConfigResourceUtils.getProfileSpriteFrame(asset.type, asset.path, (error, frame) => {
                        if (error || !isValid(frame, true)) {
                            asset.cache.delete(asset.path);
                            reject(error ?? new Error(`Không tải được ${asset.path}`));
                        } else resolve();
                    });
                })));
            }
            if (this.pendingOpen !== ticket || !isValid(this, true)) return;
            this.clearLoading();
            this.openProfileEditPopup(callback);
        } catch (error) {
            if (this.pendingOpen === ticket) {
                console.warn('[ProfilePopupHolder] Không tải được avatar/frame. Có thể bấm Profile để thử lại.', error);
                callback?.();
            }
        } finally {
            if (this.pendingOpen === ticket) {
                this.pendingOpen = null;
                this.clearLoading();
            }
        }
    }

    private openProfileEditPopup(callback?: Function): void {
        if (!this.profileEditPopupPrefab) {
            console.warn('[ProfilePopupHolder] Chưa gán profileEditPopupPrefab.');
            if (callback) callback();
            return;
        }
        if (this.profileEditPopup) {
            this.profileEditPopup.node.setSiblingIndex(999);
            this.profileEditPopup.showProfilePopup(callback);
            return;
        }
        const node = instantiate(this.profileEditPopupPrefab);
        node.setParent(this.parent);
        node.setSiblingIndex(999);
        this.profileEditPopup = node.getComponent(ProfileEditPopup);
        if (!this.profileEditPopup) {
            console.warn('[ProfilePopupHolder] Prefab thiếu component ProfileEditPopup.');
            if (callback) callback();
            return;
        }
        this.profileEditPopup.showProfilePopup(callback);
    }
}
