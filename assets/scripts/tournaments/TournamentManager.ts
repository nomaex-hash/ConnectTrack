// @ts-nocheck
import { _decorator, Component, director, Node } from 'cc';
import { TournamentSaveData } from './TournamentSaveData';
import { configuration } from '../framework/configuration';
import { LeaderboardDataInfo } from '../common/LeaderboardDataInfo';
import { TournamentReward } from './TournamentReward';
import { ReadDataJsonCommon } from '../data/ReadDataJsonCommon';
import { clientEvent } from '../framework/clientEvent';
import { Constants, ENV_TYPE } from '../framework/constants';
import { localConfig } from '../localConfig';
import { ResourceRewards } from '../datainfo/GameResource';
const { ccclass, property } = _decorator;

@ccclass('TournamentManager')
export class TournamentManager extends Component {
    public static instance: TournamentManager = null;
    protected onLoad(): void {
        director.addPersistRootNode(this.node);
        TournamentManager.instance = this;
        // Bản gốc chỉ gọi initTournamentManager() từ LoadSceneManager.ts (hệ thống loading không
        // copy sang Dogdoku) — tự gọi ngay để tournamentDataSave không bao giờ null.
        this.initTournamentManager();
    }

    arrTournament_LeaderBoardDataInfos:LeaderboardDataInfo[] = [];

    tournamentDataSave:TournamentSaveData = null;

    currTournamentDataInfo:LeaderboardDataInfo = null;

    tournamentRewards:ResourceRewards[] = [];

    initTournamentManager(){
        this.tournamentRewards = ReadDataJsonCommon.instance.readTournamentData();
        // console.log("initTournamentManager",this.tournamentRewards);
        this.tournamentDataSave = new TournamentSaveData();
        this.tournamentDataSave.initTournamentData(configuration.instance.getData_Tournament());

        if(localConfig.instance.envType === ENV_TYPE.TEST_AD){
            let leaderboardDataInfo = new LeaderboardDataInfo();
            leaderboardDataInfo.contextId = "1";
            leaderboardDataInfo._id = "1";
            leaderboardDataInfo.expireTime = 1923204568;
            // leaderboardDataInfo.expireTime =  Math.floor(Date.now() / 1000) + 60;
            leaderboardDataInfo.name = "Foodie Tournament";
            leaderboardDataInfo.tournamentId = "1";
            leaderboardDataInfo.levelIndex = 12;
            this.arrTournament_LeaderBoardDataInfos.push(leaderboardDataInfo);
        }
    }

    setSaveDataTournament(){
        let strTournamentData = this.tournamentDataSave.getStrTournamentData();
        configuration.instance.setData_Tournament(strTournamentData);
    }

    setTournamentClaimed(tournamentID: string) {
        this.tournamentDataSave.arrTournamentClaimed.push(tournamentID);
        this.setSaveDataTournament();

        clientEvent.dispatchEvent(Constants.TOURNAMENT_CLAIMED_UPDATE);
    }

    checkTournamentClaimed(tournamentID: string): boolean {
        return this.tournamentDataSave.arrTournamentClaimed.indexOf(tournamentID) != -1 ? true : false;
    }
}


