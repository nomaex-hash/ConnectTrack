// @ts-nocheck
import { _decorator, CCFloat, Component, Node, ParticleSystem } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ItemCoinEfxReceive')
export class ItemCoinEfxReceive extends Component {
    @property(ParticleSystem)
    arrEfxs: ParticleSystem[] = [];
    @property(CCFloat)
    timeAutoFinished: number = 3;
    showEfxCoinReceive() {
        this.scheduleOnce(() => {
            this.node.active = false;
        },this.timeAutoFinished);
        
        for (let i = 0; i < this.arrEfxs.length; i++) {
            this.arrEfxs[i].play();
        }
    }
}


