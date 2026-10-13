// @ts-nocheck
import { _decorator, Component, Label, Node, tween, Tween, UIOpacity, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ItemCoinLabel')
export class ItemCoinLabel extends Component {
    @property(UIOpacity)
    groupAllOpacity: UIOpacity = null;

    @property(Node)
    groupAll: Node = null;

    @property(Label)
    txtCoin: Label = null;
    
    tweenShowScale:Tween<{}> = null;
    tweenShowPos:Tween<{}> = null;
    tweenShowOpacity:Tween<{}> = null;

    initItemCoinLabel(coin: number) {
        if(this.tweenShowScale) this.tweenShowScale.stop();
        if(this.tweenShowPos) this.tweenShowPos.stop();
        if(this.tweenShowOpacity) this.tweenShowOpacity.stop();

        this.node.active = true;
        this.txtCoin.string = `+${coin}`;
        this.groupAllOpacity.opacity = 0;
        this.groupAll.setPosition(new Vec3(0, 0, 0));
        this.groupAll.setScale(new Vec3(0, 0, 0));
        this.tweenShowOpacity = tween(this.groupAllOpacity)
            .to(0.3, { opacity: 255 })
            .to(0.6, { opacity: 255 })
            .to(0.12, { opacity: 0 })
            .union()
            .call(() => {
                this.node.active = false;
            })
            .start();

        this.tweenShowPos = tween(this.groupAll).delay(0.25)
            .to(0.75, { position: new Vec3(0, 110, 0) })
            .union()
            .start();

        this.tweenShowScale = tween(this.groupAll)
            .to(0.25, { scale: new Vec3(1, 1, 1) })
            .union()
            .start();

    }
}


