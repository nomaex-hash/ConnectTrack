// @ts-nocheck
import { _decorator, Button, Component, Node } from 'cc';
import { LEADERBOARD_TAB_TYPE } from './LeaderboardManager';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
const { ccclass, property } = _decorator;

@ccclass('ItemTabLeaderboard')
export class ItemTabLeaderboard extends Component {
    @property({ type: LEADERBOARD_TAB_TYPE })
    leaderboardTabType: LEADERBOARD_TAB_TYPE = LEADERBOARD_TAB_TYPE.WEEK;

    @property(Node)
    nodeActive: Node = null;

    @property(Button)
    btnTabLeaderboard: Button = null;
    
    protected onEnable(): void {
        this.btnTabLeaderboard.node.on(Constants.CLICK, this.onTouchTabLeaderboard, this);
    }

    protected onDisable(): void {
        this.btnTabLeaderboard.node.off(Constants.CLICK, this.onTouchTabLeaderboard, this);
    }

    setItemON(){
        this.nodeActive.active = true;
    }

    setItemOFF(){
        this.nodeActive.active = false;
    }

    onTouchTabLeaderboard() {
         clientEvent.dispatchEvent(Constants.LEADERBOARD_POPUP_TOUCH_TAB,this.leaderboardTabType);
    }

}


