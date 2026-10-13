// @ts-nocheck

import { _decorator, Component, Button, Node, tween, Vec3, Tween } from "cc";
import { AudioManager2, SOUND_NAME } from "../framework/audioManager2";
const { ccclass, property , menu, requireComponent, disallowMultiple} = _decorator;


@ccclass("btnAdapter")
@menu('自定义组件/btnAdapter')
@requireComponent(Button)
@disallowMultiple
export class btnAdapter extends Component {

    /**
     * 点击后是否播放点击音效
     * @property isPlaySound
     * @type {Boolean}
     * @default true
     */
    @property({tooltip: '点击后是否播放点击音效'})
    isPlaySound = true;

    /**
     * 点击音效名
     * @property clickSoundName
     * @type {String}
     * @default true
     */
    @property({ tooltip: '点击音效名'})
    clickSoundName = 'click';

    /**
     * 是否禁止快速二次点击
     * @property isPreventSecondClick
     * @type {Boolean}
     * @default true
     */
    @property({tooltip: '是否禁止快速二次点击'})
    isPreventSecondClick = true;

    /**
     * 点击后多久才能再次点击,仅isPreventSecondClick为true生效
     * @property preventTime
     * @type {number}
     * @default true
     */
    @property({tooltip: '点击后多久才能再次点击,仅isPreventSecondClick为true生效'})
    preventTime = 0.2;

    @property({ tooltip: '是否启用按钮呼吸动画 (scale forever)' })  
    isIdleScale = false;

    idleTween: Tween<Node> | null = null

    protected onEnable(): void {
        if(this.isIdleScale){
            this.node.on(Node.EventType.TOUCH_START, this.forceSetScaleBig, this)
            this.node.on(Node.EventType.TOUCH_END, this.forceSetScaleNormal, this)
            this.node.on(Node.EventType.TOUCH_CANCEL, this.forceSetScaleNormal, this)
        }
    }

    protected onDisable(): void {
        if(this.isIdleScale){
            this.node.off(Node.EventType.TOUCH_START, this.forceSetScaleBig, this)
            this.node.off(Node.EventType.TOUCH_END, this.forceSetScaleNormal, this)
            this.node.off(Node.EventType.TOUCH_CANCEL, this.forceSetScaleNormal, this)
        }
    }

    start () {
        const button = this.node.getComponent(Button)!;
        this.node.on('click', () => {
            if (this.isPreventSecondClick) {
                button.interactable = false;
                this.scheduleOnce(() => {
                    if (button.node) button.interactable = true;
                }, this.preventTime);
            }

            if (this.isPlaySound) AudioManager2.instance?.playSound(SOUND_NAME.CLICK);
        });

        if(this.isIdleScale){
            this.startIdleTween();
        }
    }

    forceSetScaleBig(){
        if(this.isIdleScale){
            this.stopIdleTween();
            this.node.setScale(1.2, 1.2, 1.2);
        }
    }

    forceSetScaleNormal(){
        if(this.isIdleScale){
            this.stopIdleTween();
            this.node.setScale(1,1,1);
            this.startIdleTween();
        }
    }


    private startIdleTween() {
        this.idleTween = tween(this.node)
            .repeatForever(
                tween()
                    .to(1, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'sineOut' })
                    .to(1, { scale: new Vec3(1, 1, 1) }, { easing: 'sineIn' })
            )
            .start();
    }

    private stopIdleTween() {
        if (this.idleTween) {
            this.idleTween.stop();
            this.idleTween = null;
        }
        // Kill tất cả tween đang bám vào node này, tránh xung đột
        Tween.stopAllByTarget(this.node);
    }

};
