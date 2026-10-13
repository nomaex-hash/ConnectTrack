// @ts-nocheck
import { _decorator, Component, director, game, Node } from 'cc';
import { AVATAR_TYPE, Constants, ENV_TYPE } from '../framework/constants';
import { FBInstantManager } from './FBInstantManager';
import { ItemRankInfo } from './ItemRankInfo';
import { localConfig } from '../localConfig';
import { clientEvent } from '../framework/clientEvent';
import { LeaderboardDataInfo } from './LeaderboardDataInfo';
import { LeaderboardManager } from '../leaderboard/LeaderboardManager';
import { TournamentManager } from '../tournaments/TournamentManager';
import { ProfileManager } from '../profile/ProfileManager';
const { ccclass, property } = _decorator;

@ccclass('PGSPlayInstantManager')
export class PGSPlayInstantManager extends Component {
    public static instance: PGSPlayInstantManager;
    
    isLogin:boolean = false;
    onLoad(){
        director.addPersistRootNode(this.node);
        PGSPlayInstantManager.instance = this; 
        //console.log(this.isTest);
    }

    LoginFBInstant(){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.LoginFBInstant_signature(signature);
            
        });
    }

    private LoginFBInstant_signature(strSignature:string){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        myHeaders.append("Content-Type", "application/json");

        let namePlayer = ProfileManager.instance.getName();
        if(namePlayer == "") namePlayer = "Guest";
        const raw = JSON.stringify({
            "gameId": Constants.PGS_GAMEID,
            "playerId": FBInstant.player.getID(),
            "name": namePlayer,
            "avatar": ProfileManager.instance.getAvatarURL(),
            "asid": ""
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/player/", requestOptions)
            .then((response) => response.text())
            .then((result) => {
                console.log(result);
                this.isLogin = true;

                // this.GetTopPlayers();
                this.GetRemoteConfig();

            })
            .catch((error) => console.error(error));
    }


    UpdatePlayerInfo(name:string,avatarURL:string){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.UpdatePlayerInfo_signature(signature,name,avatarURL);
            
        });
    }

    private UpdatePlayerInfo_signature(strSignature:string,name:string,avatarURL:string){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "gameId": Constants.PGS_GAMEID,
            "playerId": FBInstant.player.getID(),
            "name": name,
            "avatar": avatarURL,
            "asid": ""
        });

        const requestOptions = {
            method: "PUT",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };
    }
    public UpdatePlayerScore(score:number){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.UpdatePlayerScore_signature(signature,score);
            
        });
    }

    private UpdatePlayerScore_signature(strSignature:string,score:number){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "score": score
        });

        const requestOptions = {
            method: "PUT",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/player/"+Constants.PGS_GAMEID+"/"+FBInstant.player.getID()+"/points", requestOptions)
            .then((response) => response.text())
            .then((result) => console.log(result))
            .catch((error) => console.error(error));
    }

    public GetPlayer_byPlayerIds(arrPlayerIDs:string[]){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.GetPlayer_byPlayerIds_signature(signature,arrPlayerIDs);
            
        });
    }

    private GetPlayer_byPlayerIds_signature(strSignature:string,arrPlayerIDs:string[]){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        let strPlayerIds = "";
        for(let i=0;i<arrPlayerIDs.length;i++){
            if(i==0){
                strPlayerIds = arrPlayerIDs[i];
            }else{
                strPlayerIds = strPlayerIds + "," + arrPlayerIDs[i];
            }
        }

        const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/player/?playerIds="+strPlayerIds+"&gameId="+Constants.PGS_GAMEID, requestOptions)
        .then((response) => response.json())
        .then((result) => {
            // console.log(result);
            for(let i=0;i<result.data.length;i++){
                let playerInfo = result.data[i];
                if(playerInfo && playerInfo.score){
                    let indexFriend: number = localConfig.instance.arrConnectedPlayerInfos.findIndex(item => item.id == playerInfo.playerId);
                    if(indexFriend > -1){
                        localConfig.instance.arrConnectedPlayerInfos[indexFriend].level = playerInfo.score;
                    }
                }
                
            }

            // console.log(localConfig.instance.arrConnectedPlayerInfos);
        })
        .catch((error) => console.error(error));
    }

    public GetTopPlayers(){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.GetTopPlayers_signature(signature);
            
        });
    }

    private GetTopPlayers_signature(strSignature:string){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);

        const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/player/top-players?gameId="+Constants.PGS_GAMEID+"&limit=100&sortField=score&sortOrder=desc", requestOptions)
        .then((response) => response.text())
        .then((result) => {
            // console.log(result);
            let jsonData = JSON.parse(result);
            let arrListLeaderboard_Ranks : ItemRankInfo[] = [];
            for(let i=0;i<jsonData.data.length;i++){
                let itemRankInfo:ItemRankInfo = new ItemRankInfo();
                itemRankInfo.userName = jsonData.data[i].name;
                itemRankInfo.avatarType = AVATAR_TYPE.TYPE_WEB;
                itemRankInfo.userScore = jsonData.data[i].score;
                itemRankInfo.avatarURL = jsonData.data[i].avatar;
                itemRankInfo.indexRank = i+1;
                itemRankInfo.isMyRank = jsonData.data[i].playerId == FBInstant.player.getID();
                itemRankInfo.playerID = jsonData.data[i].playerId;
                if(!itemRankInfo.isMyRank){
                    arrListLeaderboard_Ranks.push(itemRankInfo);
                }
            }

            LeaderboardManager.instance.arrTopPlayers = arrListLeaderboard_Ranks;
        })
        .catch((error) => console.error(error));
                
    }

    public GetLeaderboards_byContextIDs(arrContextIDs:string[],cbWhenDone?:Function){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.GetLeaderboards_byContextIDs_signature(signature,arrContextIDs,cbWhenDone);
            
        });
    }

    private GetLeaderboards_byContextIDs_signature(strSignature:string,arrContextIDs:string[],cbWhenDone?:Function){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);

        let strContextIDs = "";
        for(let i=0;i<arrContextIDs.length;i++){
            if(i==0){
                strContextIDs = arrContextIDs[i];
            }else{
                strContextIDs = strContextIDs + "," + arrContextIDs[i];
            }
        }

        const requestOptions = {
            method: "GET",
            headers: myHeaders,
            redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/leaderboard/"+Constants.PGS_GAMEID+"/contextIds?contextIds="+strContextIDs, requestOptions)
        .then((response) => response.text())
        .then((result) => {
            // console.log(result);
            let jsonData = JSON.parse(result);
            for(let i=0;i<jsonData.data.length;i++){
                let leaderboardInfo = jsonData.data[i];
                // console.log(leaderboardInfo);
                LeaderboardManager.instance.arrLeaderBoardDataInfos.push(leaderboardInfo);
                if(cbWhenDone) cbWhenDone();
            }

        })
        .catch((error) => console.error(error));
    }

    // public GetTournament_Leaderboards_byContextIDs(arrTournamentContextIDs:string[]){
    //     if(localConfig.instance.envType != ENV_TYPE.FB) return;
    //     FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
    //         const playerID: string = signedPlayerInfo.getPlayerID();
    //         const signature: string = signedPlayerInfo.getSignature();
    //         //console.log(signature);
    //         this.GetTournament_Leaderboards_byContextIDs_signature(signature,arrTournamentContextIDs);
            
    //     });
    // }

    // private GetTournament_Leaderboards_byContextIDs_signature(strSignature:string,arrTournamentContextIDs:string[]){
    //     const myHeaders = new Headers();
    //     myHeaders.append("x-signature", strSignature);
    //     myHeaders.append("x-id", Constants.PGS_GAMEID);

    //     let strContextIDs = "";
    //     for(let i=0;i<arrTournamentContextIDs.length;i++){
    //         if(i==0){
    //             strContextIDs = arrTournamentContextIDs[i];
    //         }else{
    //             strContextIDs = strContextIDs + "," + arrTournamentContextIDs[i];
    //         }
    //     }

    //     const requestOptions = {
    //         method: "GET",
    //         headers: myHeaders,
    //         redirect: "follow"
    //     };

    //     fetch("https://playinstant.playgameo.com/api/leaderboard/"+Constants.PGS_GAMEID+"/contextIds?contextIds="+strContextIDs, requestOptions)
    //     .then((response) => response.text())
    //     .then((result) => {
    //         // console.log(result);
    //         let jsonData = JSON.parse(result);
    //         for(let i=0;i<jsonData.data.length;i++){
    //             let leaderboardInfo = jsonData.data[i];
    //             // console.log(leaderboardInfo);
    //             for(let j=0;j<localConfig.instance.arrTournament_LeaderBoardDataInfos.length;j++){
    //                 if(localConfig.instance.arrTournament_LeaderBoardDataInfos[j].tournamentId == leaderboardInfo.tournamentId && localConfig.instance.arrTournament_LeaderBoardDataInfos[j].contextId == leaderboardInfo.contextId){
    //                     localConfig.instance.arrTournament_LeaderBoardDataInfos[j]._id = leaderboardInfo._id;
    //                 }
    //             }

    //             PGSPlayInstantManager.instance.GetTournament_TopPlayers_byLeaderboardID(leaderboardInfo._id,leaderboardInfo.tournamentId);
    //         }

    //         // console.log(localConfig.instance.arrEventDataInfos);
    //     })
    //     .catch((error) => console.error(error));
    // }

    public UpdatePlayerScore_byLeaderboardID(leaderboardID:string,score:number){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        if(leaderboardID == "") return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.UpdatePlayerScore_byLeaderboardID_signature(signature,leaderboardID,score);
            
        });
    }

    private UpdatePlayerScore_byLeaderboardID_signature(strSignature:string,leaderboardID:string,score:number){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
        "gameId": Constants.PGS_GAMEID,
        "playerId": FBInstant.player.getID(),
        "leaderboardId": leaderboardID,
        "score": score
        });

        const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/player-score/", requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(result))
        .catch((error) => console.error(error));
    }

    public GetTopPlayers_byLeaderboardID(leaderboardID:string,tournamentID:string){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        if(leaderboardID == "") {
            clientEvent.dispatchEvent(Constants.PGS_RECEIVE_LISTRANK_LEADERBOARD,leaderboardID);
            return;
        }
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.GetTopPlayers_byLeaderboardID_signature(signature,leaderboardID,tournamentID);
            
        });
    }

    private GetTopPlayers_byLeaderboardID_signature(strSignature:string,leaderboardID:string,tournamentID:string){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);

        const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/player-score/leaderboard/"+leaderboardID+"?limit=100", requestOptions)
        .then((response) => response.text())
        .then((result) => {
            // console.log(result);
            let jsonData = JSON.parse(result);
            // console.log(jsonData);
            let arrListLeaderboard_Ranks : ItemRankInfo[] = [];
            for(let i=0;i<jsonData.data.length;i++){
                let itemRankInfo:ItemRankInfo = new ItemRankInfo();
                itemRankInfo.userName = jsonData.data[i].name;
                itemRankInfo.avatarType = AVATAR_TYPE.TYPE_WEB;
                itemRankInfo.userScore = jsonData.data[i].score;
                itemRankInfo.avatarURL = jsonData.data[i].avatar;
                itemRankInfo.indexRank = jsonData.data[i].rank;
                itemRankInfo.isMyRank = jsonData.data[i].playerId == FBInstant.player.getID();
                itemRankInfo.playerID = jsonData.data[i].playerId;

                if(itemRankInfo.indexRank){
                    LeaderboardManager.instance.setLeaderboardMyScore_byID(tournamentID,jsonData.data[i].score);
                }
                arrListLeaderboard_Ranks.push(itemRankInfo);
            }
            LeaderboardManager.instance.setLeaderboardTotal_byID(leaderboardID,jsonData.total);
            LeaderboardManager.instance.setLeaderboardItemRankInfos_byID(leaderboardID,arrListLeaderboard_Ranks);
            // console.log(arrListLeaderboard_Ranks);
            clientEvent.dispatchEvent(Constants.PGS_RECEIVE_LISTRANK_LEADERBOARD,leaderboardID);
        })
        .catch((error) => {
            console.error(error);
            clientEvent.dispatchEvent(Constants.PGS_RECEIVE_LISTRANK_LEADERBOARD,leaderboardID);
        });
    }

    public GetRemoteConfig(){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.GetRemoteConfig_signature(signature);
            
        });
    }

    private GetRemoteConfig_signature(strSignature:string){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);

        const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/game-data/"+Constants.PGS_GAMEID, requestOptions)
        .then((response) => response.json())
        .then((result) => {
            // console.log(result);
            FBInstantManager.instance.TIME_NEXT_INTERSTITIAL = parseInt(result.data.time_next_inter);
            FBInstantManager.instance.TIME_NEXT_RELOAD_BANNER = parseInt(result.data.time_next_banner);
            
            TournamentManager.instance.arrTournament_LeaderBoardDataInfos = JSON.parse(result.data.event);
            
            localConfig.instance.isGetRemoteConfigDataSuccess = true;
            clientEvent.dispatchEvent(Constants.PGS_REMOTECONFIG_SUCCESS);
        })
        .catch((error) => {
            console.error(error);
            localConfig.instance.isGetRemoteConfigDataSuccess = true;
            clientEvent.dispatchEvent(Constants.PGS_REMOTECONFIG_SUCCESS);
        });
    }

    CancelA2U(){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.CancelA2U_signature(signature);
        });
    }

    CancelA2U_signature(strSignature:string){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "gameId": Constants.PGS_GAMEID,
            "playerId": FBInstant.player.getID()
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/a2u-notifications/cancel", requestOptions)
            .then((response) => response.text())
            .then((result) => {
                console.log(result);

            })
            .catch((error) => console.error(error));
    }

    SendA2U(){
        if(localConfig.instance.envType != ENV_TYPE.FB) return;
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.SendA2U_signature(signature);
        });
    }

    SendA2U_signature(strSignature:string){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "gameId": Constants.PGS_GAMEID,
            "playerId": FBInstant.player.getID()
        });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/a2u-notifications/", requestOptions)
            .then((response) => response.text())
            .then((result) => {
                console.log(result);

            })
            .catch((error) => console.error(error));
    }

    TrackEvent(client_id: string,eventName: string, params: any,userProperties: any){ 
        if (localConfig.instance.envType != ENV_TYPE.FB) return;
        console.error("TrackEvent",client_id,eventName, params,userProperties);
        FBInstant.player.getSignedPlayerInfoAsync('metadata').then(signedPlayerInfo => {
            const playerID: string = signedPlayerInfo.getPlayerID();
            const signature: string = signedPlayerInfo.getSignature();
            //console.log(signature);
            this.TrackEvent_signature(signature,client_id,eventName, params,userProperties);
        });
    }

    TrackEvent_signature(strSignature:string,client_id: string,eventName: string, params: any,userProperties: any){
        const myHeaders = new Headers();
        myHeaders.append("x-signature", strSignature);
        myHeaders.append("x-id", Constants.PGS_GAMEID);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "gameId": Constants.PGS_GAMEID,
            "clientId": client_id,
            "eventName": eventName,
            "params": params,
            "userId": FBInstant.player.getID(),
            "userProperties": userProperties
        });

        // let body = {
        //     "gameId": MConst.SERVER_GAME_ID,
        //     "clientId": client_id,
        //     "eventName": eventName,
        //     "params": params,
        //     "userId": FBInstant.player.getID(),
        //     "userProperties": userProperties
        // };

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow"
        };

        fetch("https://playinstant.playgameo.com/api/track-event/", requestOptions)
            .then((response) => response.text())
            .then((result) => {
                console.log(result);
            })
            .catch((error) => console.error(error));
    }
}

