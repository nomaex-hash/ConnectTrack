// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { BOOSTER_TYPE, CURRENCY_TYPE, RESOURCE_TYPE, SPECIAL_RESOURCE_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;


@ccclass('GameResource')
export class GameResource{
    Type:RESOURCE_TYPE;
    SpecificType:number;
    Value:{
        m_Value: number;
    };

    constructor(_type:RESOURCE_TYPE,_specificType:number,_value:number){
        this.Type = _type;
        this.SpecificType = _specificType;
        this.Value = {m_Value: _value};
    }

}

export class ResourceRewards{
    rewards:GameResource[];
}


