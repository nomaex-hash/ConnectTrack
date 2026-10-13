// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
import { PackageName, PriceType } from '../framework/constants';
import { GameResource } from './GameResource';
const { ccclass, property } = _decorator;

@ccclass('ShopPackageDataConfig')
export class ShopPackageDataConfig {
    packageName:PackageName;
    nonConsume:boolean;
    packageNameToUI:string;
    packageTag:string;
    packageId:string;
    price:string;
    price_amount_cents:number;
    priceType:PriceType;
    GameResources:GameResource[];

    constructor(packageName:PackageName,packageNameToUI:string,packageID:string,price:string,priceType:PriceType,gameResources:GameResource[]) {
        this.packageName = packageName;
        this.packageNameToUI = packageNameToUI;
        this.packageId = packageID;
        this.price = price;
        this.priceType = priceType;
        this.GameResources = gameResources;
    }
}
