// @ts-nocheck
import { _decorator, Button, Component, Node, UIOpacity } from 'cc';
import { PROFILE_TAB_TYPE } from './ProfileManager';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
const { ccclass, property } = _decorator;

@ccclass('ItemTabProfile')
export class ItemTabProfile extends Component {
    @property({type:PROFILE_TAB_TYPE})
    profileTabType:PROFILE_TAB_TYPE = PROFILE_TAB_TYPE.AVATAR;

    @property(Node)
    nodeActive: Node = null;

    @property(Button)
    btnTabProfile: Button = null;

    @property({ type: Node, tooltip: 'Node text (vd "Avatars"/"Frame") — mờ đi khi tab này KHÔNG được chọn.' })
    txtInfo: Node = null;

    @property({ range: [0, 255, 1], slide: true, tooltip: 'Opacity của txtInfo khi tab KHÔNG được chọn (255 = không mờ).' })
    inactiveOpacity = 150;

    protected onEnable(): void {
        this.btnTabProfile?.node.on(Constants.CLICK, this.onTouchTabProfile, this);
    }

    protected onDisable(): void {
        this.btnTabProfile?.node.off(Constants.CLICK, this.onTouchTabProfile, this);
    }

    setItemON(){
        if (this.nodeActive) this.nodeActive.active = true;
        this.setTextOpacity(255);
    }

    setItemOFF(){
        if (this.nodeActive) this.nodeActive.active = false;
        this.setTextOpacity(this.inactiveOpacity);
    }

    private setTextOpacity(opacity: number): void {
        if (!this.txtInfo) return;
        const uiOpacity = this.txtInfo.getComponent(UIOpacity) ?? this.txtInfo.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;
    }

    onTouchTabProfile() {
        clientEvent.dispatchEvent(Constants.PROFILE_POPUP_TOUCH_TAB,this.profileTabType);
    }
}
