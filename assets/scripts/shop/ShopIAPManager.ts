// @ts-nocheck
import { _decorator, Component, director, Node } from 'cc';
import { ShopIAPSaveData } from './ShopIAPSaveData';
import { configuration } from '../framework/configuration';
import { ShopPackageDataConfig } from '../datainfo/ShopPackageDataConfig';
import { Constants, PackageName } from '../framework/constants';
import { localConfig } from '../localConfig';
import { clientEvent } from '../framework/clientEvent';
import { ReadDataJsonCommon } from '../data/ReadDataJsonCommon';
const { ccclass, property } = _decorator;

@ccclass('ShopIAPManager')
export class ShopIAPManager extends Component {
    public static instance: ShopIAPManager = null;

    shopIAPSaveData:ShopIAPSaveData = null;

    protected onLoad(): void {
        director.addPersistRootNode(this.node);
        ShopIAPManager.instance = this;
        // Bản gốc chỉ gọi initShopIAPManager() từ LoadSceneManager.ts (hệ thống loading không
        // copy sang Dogdoku) — tự gọi ngay để shopIAPSaveData/mapIAP không bao giờ null.
        this.initShopIAPManager();
    }

    initShopIAPManager() {
        // ReadDataJsonCommon.instance là lazy singleton — CHỈ nạp shopData.json vào
        // localConfig.instance.arrShopPackageDataConfigs lúc .instance được chạm tới LẦN ĐẦU
        // (xem ReadDataJsonCommon.ts). Component này tự gọi initShopIAPManager() ngay trong
        // onLoad() — nếu chạy TRƯỚC khi bất kỳ đâu khác từng đụng tới ReadDataJsonCommon.instance
        // (ví dụ LeaderboardManager), arrShopPackageDataConfigs vẫn rỗng, khiến
        // checkStarterPack_IsBuyed() gọi getShopPackageDataConfig() trả về null rồi crash đọc
        // .packageId (TypeError: Cannot read properties of null lúc Boot). Chạm tới .instance ở
        // đây để CHẮC CHẮN dữ liệu đã nạp xong trước khi đọc.
        ReadDataJsonCommon.instance;

        this.shopIAPSaveData = new ShopIAPSaveData();
        this.shopIAPSaveData.initShopIAP(configuration.instance.getData_ShopIAP());
        
        // this.shopIAPSaveData.mapIAP.clear();
        // this.shopIAPSaveData.starterPack_startTime = localConfig.instance.getCurrTimeSecond();
        // console.log("this.shopIAPSaveData",this.shopIAPSaveData);
        this.initStarterPack();
    }

    addShopIAP(key: string) {
        if(!this.shopIAPSaveData.mapIAP.has(key)){
            this.shopIAPSaveData.mapIAP.set(key, 1);
        } else{
            let currValue = this.shopIAPSaveData.mapIAP.get(key);
            this.shopIAPSaveData.mapIAP.set(key, currValue + 1);
        }
        clientEvent.dispatchEvent(Constants.SHOP_IAP_UPDATE);
        this.setSaveShopIAPData();
    }

    setSaveShopIAPData() {
        configuration.instance.setData_ShopIAP(this.shopIAPSaveData.getStrShopIAP());
    }

    checkShopIAP(key: string): boolean {
        return this.shopIAPSaveData.mapIAP.has(key) && this.shopIAPSaveData.mapIAP.get(key) > 0;
    }

    
    getShopIAPCount(key: string): number {
        if(this.shopIAPSaveData.mapIAP.has(key)){
            return this.shopIAPSaveData.mapIAP.get(key);
        }
        return 0;
    }

    //#region STARTER PACK
    STARTER_PACK_TIME:number = 2 * 60 * 60;
    setStarterPackStartTime(time: number) {
        this.shopIAPSaveData.starterPack_startTime = time;
        this.setSaveShopIAPData();
    }

    checkStarterPack_IsBuyed(): boolean {
        let starterPack:ShopPackageDataConfig = localConfig.instance.getShopPackageDataConfig(PackageName.starterbundle);
        return this.shopIAPSaveData.mapIAP.has(starterPack.packageId) && this.shopIAPSaveData.mapIAP.get(starterPack.packageId) > 0;
    }

    initStarterPack(){
        if(this.checkStarterPack_IsBuyed()) return;
        if (this.shopIAPSaveData.starterPack_startTime == 0) {
            this.setStarterPackStartTime(localConfig.instance.getCurrTimeSecond());
        }else{
            let starterPackDate:Date = new Date(this.shopIAPSaveData.starterPack_startTime * 1000);
            let starterPackDay = starterPackDate.getFullYear() * 10000 + starterPackDate.getMonth() * 100 + starterPackDate.getDate();

            if(starterPackDay < localConfig.instance.getCurrDay()) {
                if(this.shopIAPSaveData.starterPack_startTime + this.STARTER_PACK_TIME < localConfig.instance.getCurrTimeSecond()){
                    this.setStarterPackStartTime(localConfig.instance.getCurrTimeSecond());
                }
            }
        }
    }

    getStarterPackTimeLeft(): number {
        return this.shopIAPSaveData.starterPack_startTime + this.STARTER_PACK_TIME - localConfig.instance.getCurrTimeSecond();
    }
    //#endregion
}


