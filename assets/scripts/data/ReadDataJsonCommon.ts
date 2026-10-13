// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;
import { localConfig } from '../localConfig';
import shopDataJson from '../data/shopData.json';
import boosterDataJson from '../data/boosterData.json';
import specialDataJson from '../data/specialData.json';
import dailyRewardDataJson from '../data/dailyRewardData.json';
import questDataJson from '../data/questData.json';
import foodiePassDataJson from '../data/battePassData.json';
import profileDataJson from '../data/profileData.json';
import riseUpDataJson from '../data/riseUpData.json';
import leaderboardDataJson from '../data/leaderboardData.json';
import tournamentDataJson from '../data/tournamentData.json';
import levelConfigsDataJson from '../data/LevelsConfigv2.json';
import loopLevelConfigsDataJson from '../data/LoopLevelsConfig.json';

@ccclass('ReadDataJsonCommon')
export class ReadDataJsonCommon{
    private static _instance: ReadDataJsonCommon = null;
    // Bản gốc chỉ set instance khi có ai gọi "new ReadDataJsonCommon()" từ hệ thống loading
    // (không copy sang Dogdoku vì không liên quan Shop/Leaderboard) — đổi sang lazy-getter,
    // mirror đúng pattern localConfig.ts đã có sẵn trong project, để .instance tự khởi tạo lần
    // đầu được gọi tới thay vì luôn là null.
    public static get instance(): ReadDataJsonCommon {
        if (!ReadDataJsonCommon._instance) new ReadDataJsonCommon();
        return ReadDataJsonCommon._instance;
    }

    //levelData:LevelData
    constructor() {
        if(ReadDataJsonCommon._instance == null){
            ReadDataJsonCommon._instance = this;

            this.readShopData();
            this.readBoosterData();
            this.readSpecialData();
            // this.readDailyRewardData();
            // this.readQuestData();
        }
    }

    public readShopData(){
        // console.log(shopDataJson);
        localConfig.instance.arrShopPackageDataConfigs = shopDataJson.shopPackages;
        // console.log(localConfig.instance.arrShopPackageDataConfigs);
    }

    public readBoosterData(){
        // console.log(boosterDataJson);
        // localConfig.instance.arrBoosterDatas = boosterDataJson;
        // console.log(localConfig.instance.arrBoosterDatas);
        return boosterDataJson;
    }

    public readSpecialData(){
        // console.log(specialDataJson);
        // localConfig.instance.arrSpecialDatas = specialDataJson;
        // console.log(localConfig.instance.arrSpecialDatas);
        return specialDataJson;
    }



    // public readDailyRewardData(){
    //     // console.log(dailyRewardDataJson);
    //     localConfig.instance.arrDailyRewards = dailyRewardDataJson.dailyRewards;
    //     // console.log(localConfig.instance.arrDailyRewards);
    // }

    public readDailyRewardDataNew(){
        return dailyRewardDataJson.dailyRewards;
    }

    // public readQuestData(){
    //     // console.log(questDataJson);
    //     localConfig.instance.arrQuestDataConfigs = questDataJson.questDataConfigs;
    //     // console.log("arrQuestDataConfigs",localConfig.instance.arrQuestDataConfigs);
    // }

    public readDailyQuestDataNew(){
        return questDataJson.questDataConfigs;
    }


    public readFoodiePassData(){
        // console.log("readFoodiePassData",foodiePassDataJson);
        // BattlePassManager.instance.arrFoodiePassDataConfigs = foodiePassDataJson.battlePassDetailConfigs;
        // console.log("arrFoodiePassDataConfigs",BattlePassManager.instance.arrFoodiePassDataConfigs);
        return foodiePassDataJson.battlePassDetailConfigs;
    }

    public readAvatarsData(){
        return profileDataJson.avatarDatas;
    }

    public readFramesData(){
        return profileDataJson.frameDatas;
    }

    public readRiseUpData(){
        return riseUpDataJson.riseUpDetails;
    }

    public readLeaderboardData(){
        return leaderboardDataJson.leaderboardRewards;
    }

    public readTournamentData(){
        return tournamentDataJson.tournamentRewards;
    }

    public readLevelConfigsData(){
        return levelConfigsDataJson.levelConfigModels;
    }

    public readLoopLevelConfigsData(){
        return loopLevelConfigsDataJson.levelConfigModels;
    }
}


