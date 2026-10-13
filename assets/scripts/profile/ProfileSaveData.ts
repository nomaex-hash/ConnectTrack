// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ProfileSaveData')
export class ProfileSaveData {
    name:string = "";
    avartar:number = 0;
    frame:number = 0;
    createTime:number = 0;
    changeNameCompleted:number = 0;

    getStrProfileData():string{
        let strProfileData:string = "";
        strProfileData += this.name + "|";
        strProfileData += this.avartar + "|";
        strProfileData += this.frame + "|";
        strProfileData += this.createTime + "|";
        strProfileData += this.changeNameCompleted;

        return strProfileData;
    }

    initProfileData(strProfileData:string){
        if(strProfileData.length == 0) return;
        let arrProfileDatas = strProfileData.split("|");
        if(arrProfileDatas[0] && arrProfileDatas[0].length > 0){
            this.name = arrProfileDatas[0];
        }
        if(arrProfileDatas[1] && arrProfileDatas[1].length > 0){
            this.avartar = parseInt(arrProfileDatas[1]);
        }
        if(arrProfileDatas[2] && arrProfileDatas[2].length > 0){
            this.frame = parseInt(arrProfileDatas[2]);
        }

        if(arrProfileDatas[3] && arrProfileDatas[3].length > 0){
            this.createTime = parseInt(arrProfileDatas[3]);
        }

        if(arrProfileDatas[4] && arrProfileDatas[4].length > 0){
            this.changeNameCompleted = parseInt(arrProfileDatas[4]);
        }
    }
}


