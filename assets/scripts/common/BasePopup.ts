// @ts-nocheck

import { _decorator, Component, Node, tween, Vec3, Button, UIOpacity, CCBoolean, Tween } from 'cc';
import { AudioManager2, SOUND_NAME } from '../framework/audioManager2';
import { Constants } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('BasePopup')
export class BasePopup extends Component {
    
    @property(CCBoolean)
    isTweenPopup:boolean = true;

    @property(UIOpacity)
    bgOpacity:UIOpacity = null;

    @property(Node)
    popup : Node;

    @property(UIOpacity)
    popup_UIOpacity:UIOpacity;

    @property(Node)
    lockGroup : Node;

    @property(Button)
    btnClose : Button | null = null;

    @property({
        type: Node,
        tooltip:
            'Icon LOADING — gắn node có component IconLoading2 (tự xoay qua schedule()) — TỰ hiện ' +
            'ngay lúc showPopup(), TỰ tắt khi subclass gọi hideLoading() (báo đã tải xong dữ liệu). ' +
            'Để TRỐNG thì bỏ qua hẳn tính năng này, không crash. Popup KHÔNG có tải bất đồng bộ gì ' +
            'thì gọi hideLoading() NGAY ĐẦU luồng show (vd đầu showRewardReceivePopup()) để tắt ' +
            'luôn, tránh xoay mãi không dừng. CÙNG pattern với UIPopup.loadingIcon (các popup mới ' +
            'hơn, không dùng BasePopup).',
    })
    loadingIcon: Node | null = null;

    cbWhenClose:Function = null;

    tweenScalePopup: Tween<{}> = null;
    tweenOpacityPopup: Tween<{}> = null;
    tweenOpacityBG: Tween<{}> = null;
    onLoad(){

    }
    start () {
        // [3].
        
    }

    onEnable(){
        if(this.btnClose!= null){
            this.btnClose!.node.on(Constants.CLICK,this.touchClose,this);
        }
    }

    onDisable(){
        if(this.btnClose!= null){
            this.btnClose!.node.off(Constants.CLICK,this.touchClose,this);
        }
    }
    // update (deltaTime: number) {
    //     // [4]
    // }

    resetPopup(){
        if(this.isTweenPopup){
            this.popup_UIOpacity.opacity = 150;
            this.popup.setScale(new Vec3(0.5,0.5,0.5));
            // Guard: không phải popup nào cũng cần lớp nền mờ riêng (bgOpacity có thể để trống nếu
            // popup không dùng) — trước đây bắt buộc gán, thiếu là crash ngay khi mở popup.
            if (this.bgOpacity) this.bgOpacity.opacity = 150;
        }
        // Guard: không phải popup nào cũng cần khoá input lúc đang tween (lockGroup có thể để
        // trống nếu popup không cần) — trước đây bắt buộc gán, thiếu là crash ngay khi mở popup.
        if (this.lockGroup) this.lockGroup.active = true;
    }

    /** Hiện loadingIcon (nếu có gán) — chỉ cần bật node.active, chính component IconLoading2 trên
     * node đó tự lo xoay qua onEnable()/schedule(), KHÔNG cần tween thủ công ở đây. Tự gọi ngay lúc
     * showPopup(); subclass gọi lại TAY nếu cần hiện lại loading giữa chừng. */
    showLoading(){
        if (this.loadingIcon) this.loadingIcon.active = true;
    }

    /** Tắt hẳn loadingIcon (nếu có gán) — node.active=false tự kích IconLoading2.onDisable() dừng
     * xoay. Subclass gọi khi dữ liệu đã sẵn sàng để hiện popup bình thường. An toàn gọi nhiều lần /
     * gọi khi chưa từng showLoading(). */
    hideLoading(){
        if (this.loadingIcon) this.loadingIcon.active = false;
    }

    showPopup(_cbWhenClose:Function = null){
        this.cbWhenClose = _cbWhenClose;
        // Mặc định LUÔN hiện icon loading ngay khi popup vừa showPopup() — subclass tự gọi
        // hideLoading() khi đã sẵn sàng. Popup nào không có gì phải đợi thì chỉ cần gọi
        // hideLoading() ngay đầu luồng show của nó (cùng quy ước UIPopup.show()).
        this.showLoading();
        if (this.tweenScalePopup) {
            this.tweenScalePopup.stop();
        }

        if (this.tweenOpacityPopup) {
            this.tweenOpacityPopup.stop();
        }

        if (this.tweenOpacityBG) {
            this.tweenOpacityBG.stop();
        }
        if (this.isTweenPopup) {
            this.popup_UIOpacity.opacity = 150;
            this.popup.setScale(new Vec3(0.5, 0.5, 0.5));
            if (this.bgOpacity) this.bgOpacity.opacity = 150;
        } else {
            this.popup_UIOpacity.opacity = 255;
            this.popup.setScale(new Vec3(1, 1, 1));
            if (this.bgOpacity) this.bgOpacity.opacity = 255;
        }

        if (this.lockGroup) this.lockGroup.active = true;
        this.node.active = true;
        this.showPoup_ShowView();
    }

    showPopup_Now(){
        this.popup_UIOpacity.opacity = 255;
        this.popup.setScale(new Vec3(1, 1, 1));
        if (this.bgOpacity) this.bgOpacity.opacity = 255;
        if (this.lockGroup) this.lockGroup.active = false;
        this.node.active = true;
    }

    showPoup_ShowView(){
        if(this.isTweenPopup){
            this.popup_UIOpacity.opacity = 0;
            this.popup.setScale(new Vec3(0.5,0.5,0.5));
            this.tweenScalePopup = tween(this.popup).to(0.4,{scale: new Vec3(1,1,1)}, { easing: 'backOut',onComplete:()=>{
                this.showPoup_ShowView_Finished();
            }}).start();

            this.tweenOpacityPopup = tween(this.popup_UIOpacity).to(0.2,{opacity:255},{easing:'quadOut',onComplete:()=>{

            }}).start();

            if (this.bgOpacity) {
                this.tweenOpacityBG = tween(this.bgOpacity).to(0.2, { opacity: 255 }, {
                    easing: 'quadOut', onComplete: () => {

                    }
                }).start();
            }
        }else{
            this.showPoup_ShowView_Finished();
        }
    }

    showPoup_ShowView_Finished(){
        this.node.active = true;
        if (this.lockGroup) this.lockGroup.active = false;
    }




    hidePopup(){
        if (this.lockGroup) this.lockGroup.active = true;
        if(this.isTweenPopup){
            this.tweenScalePopup = tween(this.popup).to(0.3,{scale: new Vec3(0.5,0.5,0.5)}, { easing: 'quadOut',onComplete:()=>{
                this.hidePopup_Finished();
            }}).start();

            this.tweenOpacityPopup = tween(this.popup_UIOpacity).to(0.2,{opacity:0},{easing:'quadOut',onComplete:()=>{

            }}).start();

            if (this.bgOpacity) {
                this.tweenOpacityBG = tween(this.bgOpacity).to(0.3, { opacity: 0 }, {
                    easing: 'quadOut', onComplete: () => {

                    }
                }).start();
            }
        }else{
            this.hidePopup_Finished();
        }
    }

    hidePopup_Finished(){
        // Phòng hờ: popup bị đóng NGAY GIỮA LÚC vẫn còn "loading" (subclass chưa kịp gọi
        // hideLoading()) — tắt hẳn icon, tránh IconLoading2 tiếp tục schedule() xoay trên 1 node đã
        // ẩn (cùng lý do UIPopup.finishClose()).
        this.hideLoading();
        if (this.lockGroup) this.lockGroup.active = false;
        this.node.active = false;
    }

    touchClose(){
        this.hidePopup();
    }
}

/**
 * [1] Class member could be defined like this.
 * [2] Use `property` decorator if your want the member to be serializable.
 * [3] Your initialization goes here.
 * [4] Your update function goes here.
 *
 * Learn more about scripting: https://docs.cocos.com/creator/3.0/manual/en/scripting/
 * Learn more about CCClass: https://docs.cocos.com/creator/3.0/manual/en/scripting/ccclass.html
 * Learn more about life-cycle callbacks: https://docs.cocos.com/creator/3.0/manual/en/scripting/life-cycle-callbacks.html
 */
