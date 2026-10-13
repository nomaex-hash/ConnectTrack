// @ts-nocheck

import { _decorator, Component, Node, Vec3, instantiate, Prefab } from 'cc';
import { Constants } from '../framework/constants';
import { clientEvent } from '../framework/clientEvent';
import { localConfig } from '../localConfig';
import { ItemCoin } from './ItemCoin';
import Utils from '../core/utils/Utils';
import { ItemCoinLabel } from './ItemCoinLabel';
const { ccclass, property } = _decorator;

/**
 * Predefined variables
 * Name = CoinPoolManager
 * DateTime = Tue Feb 08 2022 09:11:04 GMT+0700 (Indochina Time)
 * Author = tuzkekizer
 * FileBasename = CoinPoolManager.ts
 * FileBasenameNoExtension = CoinPoolManager
 * URL = db://assets/scripts/scene/play/CoinPoolManager.ts
 * ManualUrl = https://docs.cocos.com/creator/3.4/manual/en/
 *
 */
 
@ccclass('CoinPoolManager')
export class CoinPoolManager extends Component {
    // [1]
    // dummy = '';

    // [2]
    // @property
    // serializableDummy = 0;

    @property(Prefab)
    itemPoolPrefab:Prefab;

    @property(Node)
    poolParentNode:Node;

    @property(Prefab)
    itemPoolLabelPrefab:Prefab;

    @property(Node)
    poolParentNodeLabel:Node;


    @property(Node)
    target_Node:Node;

    @property(Node)
    start_Node:Node;

    arrPools:Node[] = [];

    arrPoolsLabel:Node[] = [];

    static instance: CoinPoolManager;

    onLoad() {
        CoinPoolManager.instance = this;
    }

    onEnable(){
        clientEvent.on(Constants.SHOW_ADDCOIN,this.showAddCoin,this);
        clientEvent.on(Constants.UPDATE_COIN_TARGETPOS,this.updateTargetPos,this);
        clientEvent.on(Constants.UPDATE_COIN_STARTPOS,this.updateStartPos,this);
    }

    onDisable(){
        clientEvent.off(Constants.SHOW_ADDCOIN,this.showAddCoin,this);
        clientEvent.off(Constants.UPDATE_COIN_TARGETPOS,this.updateTargetPos,this);
        clientEvent.off(Constants.UPDATE_COIN_STARTPOS,this.updateStartPos,this);
    }

    start () {
        // [3]
    }

    updateTargetPos(posTarget:Vec3){
        // console.log("updateCOIN StartPos",posTarget);
        this.target_Node.setWorldPosition(posTarget);
    }

    updateStartPos(posStart:Vec3){
        this.start_Node.setWorldPosition(posStart);
    }

    showAddCoin(totalCoinAdd:number){
        let itemCoinLabel = this.getItemLabel();
        itemCoinLabel.setWorldPosition(this.start_Node.worldPosition);
        itemCoinLabel.getComponent(ItemCoinLabel).initItemCoinLabel(totalCoinAdd);


        let listCoinValue:number[] = Utils.generateListValue_fromTotal(totalCoinAdd,10);

        for(let i=0; i < listCoinValue.length;i++){
            let itemCoin = this.getItem();
            itemCoin.getComponent(ItemCoin).initCoin(listCoinValue[i],this.start_Node.position,this.target_Node.position,0.5+ i * 0.06);
        }
    }



    getItem(){
        for(let i=0; i< this.arrPools.length;i++){
            if(!this.arrPools[i].active){
                return this.arrPools[i];
            }
        }

        let obj = instantiate(this.itemPoolPrefab);
        obj.parent = this.poolParentNode;
        this.arrPools.push(obj);
        return obj;
        
    }

    getItemLabel(){
        for(let i=0; i< this.arrPoolsLabel.length;i++){
            if(!this.arrPoolsLabel[i].active){
                return this.arrPoolsLabel[i];
            }
        }

        let obj = instantiate(this.itemPoolLabelPrefab);
        obj.parent = this.poolParentNodeLabel;
        this.arrPoolsLabel.push(obj);
        return obj;
        
    }

    // update (deltaTime: number) {
    //     // [4]
    // }
}

/**
 * [1] Class member could be defined like this.
 * [2] Use `property` decorator if your want the member to be serializable.
 * [3] Your initialization goes here.
 * [4] Your update function goes here.
 *
 * Learn more about scripting: https://docs.cocos.com/creator/3.4/manual/en/scripting/
 * Learn more about CCClass: https://docs.cocos.com/creator/3.4/manual/en/scripting/ccclass.html
 * Learn more about life-cycle callbacks: https://docs.cocos.com/creator/3.4/manual/en/scripting/life-cycle-callbacks.html
 */
