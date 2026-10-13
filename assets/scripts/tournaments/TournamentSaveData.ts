// @ts-nocheck
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TournamentSaveData')
export class TournamentSaveData {
    arrTournamentClaimed: string[] = [];

    getStrTournamentData() {
        let strTournamentData = this.arrTournamentClaimed.join("_");
        return strTournamentData;
    }

    initTournamentData(strTournamentData: string) {
        if (strTournamentData.length == 0 || strTournamentData.indexOf("_") == -1) return;
        this.arrTournamentClaimed = strTournamentData.split("_");
    }
}


