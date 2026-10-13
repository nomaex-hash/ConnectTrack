// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { GameResource } from '../datainfo/GameResource';
import { RESOURCE_TYPE } from '../framework/constants';
const { ccclass, property } = _decorator;

@ccclass('GameResourceSaveData')
export class GameResourceSaveData {


    arrGameResources: GameResource[] = [];

    getStrGameResourceData(){
        let strGameResource = "";
        for (let i = 0; i < this.arrGameResources.length; i++) {
            let gameResource = this.arrGameResources[i];
            if(i < this.arrGameResources.length - 1){
                strGameResource += gameResource.Type + "_" + gameResource.SpecificType + "_" + gameResource.Value.m_Value + "|";
            }else{
                strGameResource += gameResource.Type + "_" + gameResource.SpecificType + "_" + gameResource.Value.m_Value;
            }
        }
        return strGameResource;
    }


    initGameResourceData(strGameResourceData: string){
        if (strGameResourceData.length == 0) {
            return;
        }
        let arrGameResource = strGameResourceData.split("|");

        for (let i = 0; i < arrGameResource.length; i++) {
            let strGameResourceItem = arrGameResource[i];
            if(strGameResourceItem && strGameResourceItem.length > 0 && strGameResourceItem.indexOf("_") != -1){
                let arrGameResourceItem = strGameResourceItem.split("_");
                let type = parseInt(arrGameResourceItem[0]);
                let specificType = parseInt(arrGameResourceItem[1]);
                let value = parseInt(arrGameResourceItem[2]);
                if(!isNaN(type) && !isNaN(specificType) && !isNaN(value)){
                    let gameResource = new GameResource(type, specificType, value);
                    this.arrGameResources.push(gameResource);
                }
            }
        }
    }


    arrGameResources_LastTime: GameResource[] = [];

    getStrGameResourceData_LastTime(){
        let strGameResources_LastTime = "";
        for (let i = 0; i < this.arrGameResources_LastTime.length; i++) {
            let gameResource = this.arrGameResources_LastTime[i];
            if(i < this.arrGameResources_LastTime.length - 1){
                strGameResources_LastTime += gameResource.Type + "_" + gameResource.SpecificType + "_" + gameResource.Value.m_Value + "|";
            }else{
                strGameResources_LastTime += gameResource.Type + "_" + gameResource.SpecificType + "_" + gameResource.Value.m_Value;
            }
        }
        return strGameResources_LastTime;
    }


    initGameResourceData_LastTime(strGameResources_LastTime: string){
        if (strGameResources_LastTime.length == 0) {
            return;
        }
        let arrGameResource = strGameResources_LastTime.split("|");

        for (let i = 0; i < arrGameResource.length; i++) {
            let strGameResourceItem = arrGameResource[i];
            if(strGameResourceItem && strGameResourceItem.length > 0 && strGameResourceItem.indexOf("_") != -1){
                let arrGameResourceItem = strGameResourceItem.split("_");
                let type = parseInt(arrGameResourceItem[0]);
                let specificType = parseInt(arrGameResourceItem[1]);
                let value = parseInt(arrGameResourceItem[2]);
                if(!isNaN(type) && !isNaN(specificType) && !isNaN(value)){
                    let gameResource = new GameResource(type, specificType, value);
                    this.arrGameResources_LastTime.push(gameResource);
                }
            }
        }
    }



    arrGameResources_Spent: GameResource[] = [];

    getStrGameResourceData_Spent(){
        let strGameResource_Spent = "";
        for (let i = 0; i < this.arrGameResources_Spent.length; i++) {
            let gameResource = this.arrGameResources_Spent[i];
            if(i < this.arrGameResources_Spent.length - 1){
                strGameResource_Spent += gameResource.Type + "_" + gameResource.SpecificType + "_" + gameResource.Value.m_Value + "|";
            }else{
                strGameResource_Spent += gameResource.Type + "_" + gameResource.SpecificType + "_" + gameResource.Value.m_Value;
            }
        }
        return strGameResource_Spent;
    }


    initGameResourceData_Spent(strGameResourceData_Spent: string){
        if (strGameResourceData_Spent.length == 0) {
            return;
        }
        let arrGameResource = strGameResourceData_Spent.split("|");

        for (let i = 0; i < arrGameResource.length; i++) {
            let strGameResourceItem = arrGameResource[i];
            if(strGameResourceItem && strGameResourceItem.length > 0 && strGameResourceItem.indexOf("_") != -1){
                let arrGameResourceItem = strGameResourceItem.split("_");
                let type = parseInt(arrGameResourceItem[0]);
                let specificType = parseInt(arrGameResourceItem[1]);
                let value = parseInt(arrGameResourceItem[2]);
                if(!isNaN(type) && !isNaN(specificType) && !isNaN(value)){
                    let gameResource = new GameResource(type, specificType, value);
                    this.arrGameResources_Spent.push(gameResource);
                }
            }
        }
    }

    arrBoosterUnlockeds: number[] = [];
    getStrBoosterUnlockeds(){
        let strBoosterUnlockeds = "";
        for (let i = 0; i < this.arrBoosterUnlockeds.length; i++) {
            let boosterUnlocked = this.arrBoosterUnlockeds[i];
            if(i < this.arrBoosterUnlockeds.length - 1){
                strBoosterUnlockeds += boosterUnlocked + "|";
            }else{
                strBoosterUnlockeds += boosterUnlocked;
            }
        }
        return strBoosterUnlockeds;
    }

    initBoosterUnlockeds(strBoosterUnlockeds: string){
        if (strBoosterUnlockeds.length == 0) {
            return;
        }
        let arrBoosterUnlocked = strBoosterUnlockeds.split("|");
        for (let i = 0; i < arrBoosterUnlocked.length; i++) {
            let boosterUnlocked = parseInt(arrBoosterUnlocked[i]);
            if(!isNaN(boosterUnlocked)){
                this.arrBoosterUnlockeds.push(boosterUnlocked);
            }
        }
    }
}


