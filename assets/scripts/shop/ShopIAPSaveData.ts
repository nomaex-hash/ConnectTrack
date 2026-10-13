// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ShopIAPSaveData')
export class ShopIAPSaveData {
    mapIAP: Map<string, number> = new Map<string, number>();

    starterPack_startTime: number = 0;

    getStrShopIAP(): string {
        let strShopIAP = '';
        this.mapIAP.forEach((value, key) => {
            strShopIAP += `${key}_${value}|`;
        });

        strShopIAP += '#'+this.starterPack_startTime;
        return strShopIAP;
    }

    initShopIAP(strShopIAP: string) {
        if(strShopIAP.length == 0) return;
        let arrShopIAP = strShopIAP.split('#');
        // console.log("arrShopIAP",arrShopIAP);
        if(arrShopIAP[0] && arrShopIAP[0].length > 0 && arrShopIAP[0].indexOf('|') != -1){
            let arrMapIAP = arrShopIAP[0].split('|');
            // console.log("arrMapIAP",arrMapIAP);
            arrMapIAP.forEach((value) => {
                if (value.length > 0){
                    let arrValue = value.split('_');
                    const num = Number.parseInt(arrValue[1]);
                    if(Number.isInteger(num)){
                        this.mapIAP.set(arrValue[0], parseInt(arrValue[1]));
                    }
                }
            });
        }

        if(arrShopIAP[1] && arrShopIAP[1].length > 0){
            this.starterPack_startTime = parseInt(arrShopIAP[1]);
        }
    }
    
}


