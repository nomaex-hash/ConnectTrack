// @ts-nocheck
import { _decorator, Component, director, Enum, Node } from 'cc';
import { ProfileSaveData } from './ProfileSaveData';
import { configuration } from '../framework/configuration';
import { lodash } from '../framework/lodash';
import { localConfig } from '../localConfig';
import { ProfileDataDetail } from '../datainfo/ProfileDataDetail';
import { ReadDataJsonCommon } from '../data/ReadDataJsonCommon';
import { PGSPlayInstantManager } from '../common/PGSPlayInstantManager';
const { ccclass, property } = _decorator;

@ccclass('ProfileManager')
export class ProfileManager extends Component {
    public static instance: ProfileManager = null;

    protected onLoad(): void {
        director.addPersistRootNode(this.node);
        ProfileManager.instance = this;
        // Bản gốc chỉ gọi initProfileManager() từ LoadSceneManager.ts (hệ thống loading không
        // copy sang Dogdoku) — tự gọi ngay ở đây để avatarDataDetails/frameDataDetails không
        // bao giờ còn null khi các nơi khác (Leaderboard...) đọc tới.
        this.initProfileManager();
    }

    profileSaveData: ProfileSaveData = null;

    avatarDataDetails:ProfileDataDetail[] = null;
    frameDataDetails:ProfileDataDetail[] = null;

    initProfileManager(){
        this.profileSaveData = new ProfileSaveData();
        this.profileSaveData.initProfileData(configuration.instance.getData_Profile());
        let isNewUser:boolean = false;
        if(this.profileSaveData.name == "") {
            isNewUser = true;
            // this.profileSaveData.name = this.DEFAULT_PLAYER_NAMES[lodash.random(0, this.DEFAULT_PLAYER_NAMES.length)];
            configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
        }

        if(this.profileSaveData.createTime == 0) {
            isNewUser = true;
            this.profileSaveData.createTime = localConfig.instance.getCurrTimeSecond();
            configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
        }
        // if(isNewUser) {
        //     PGSPlayInstantManager.instance.UpdatePlayerInfo(this.profileSaveData.name,this.getAvatarURL());
        // }
        this.avatarDataDetails = ReadDataJsonCommon.instance.readAvatarsData();
        this.frameDataDetails = ReadDataJsonCommon.instance.readFramesData();
        const avatar = this.getAvatarSelectedID();
        const frame = this.getFrameSelectedID();
        if (avatar !== this.profileSaveData.avartar || frame !== this.profileSaveData.frame) {
            this.profileSaveData.avartar = avatar;
            this.profileSaveData.frame = frame;
            configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
        }
    }

    private resolveProfileID(id: number, entries: ProfileDataDetail[]): number {
        return entries.some((entry) => entry.Id === id) ? id : entries[0].Id;
    }

    getProfileChangeNameCompleted():boolean{
        return this.profileSaveData.changeNameCompleted == 1;
    }

    setProfileChangeNameCompleted(){
        this.profileSaveData.changeNameCompleted = 1;
        configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
    }

    getAvatarURL(){
        return this.getAvatarSelectedID()+"_"+this.getFrameSelectedID();
    }

    setAvatar(avartar:number){
        this.profileSaveData.avartar = this.resolveProfileID(avartar, this.avatarDataDetails);
        configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
    }

    getAvatarSelectedID():number{
        return this.resolveProfileID(this.profileSaveData.avartar, this.avatarDataDetails);
    }

    getPathAvatar():string{
        return this.getPathAvatar_byID(this.getAvatarSelectedID());
    }

    getPathAvatar_byID(avatarID:number):string{
        const id = this.resolveProfileID(avatarID, this.avatarDataDetails);
        return "avatars/avatar_" + id;
    }

    setFrame(frame:number){
        this.profileSaveData.frame = this.resolveProfileID(frame, this.frameDataDetails);
        configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
    }

    getFrameSelectedID():number{
        return this.resolveProfileID(this.profileSaveData.frame, this.frameDataDetails);
    }

    getPathFrame():string{
        return this.getPathFrame_byID(this.getFrameSelectedID());
    }

    getPathFrame_byID(frameID:number):string{
        const id = this.resolveProfileID(frameID, this.frameDataDetails);
        return "avatars/frame_" + id;
    }

    setName(name:string){
        this.profileSaveData.name = name;
        configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
    }

    getName():string{
        return this.profileSaveData.name;
    }

    setCreateTime(createTime:number){
        this.profileSaveData.createTime = createTime;
        configuration.instance.setData_Profile(this.profileSaveData.getStrProfileData());
    }

    getCreateTime():number{
        return this.profileSaveData.createTime;
    }

    getStrCreatTime():string{
        const date = new Date(this.profileSaveData.createTime * 1000);
        return (date.getMonth() + 1) + "/" + date.getFullYear();
    }

    /**
     * @param level Nếu truyền vào (VD level bot trong bảng xếp hạng), frame random sẽ CHỈ chọn
     * trong số frame đã mở khoá ở level đó (levelRequire <= level trong profileData.json) — bot
     * mới tới level 100 sẽ không thể "mặc" frame chỉ mở ở level 200. Bỏ trống thì random tự do
     * trong toàn bộ frame (hành vi cũ, dùng cho các chỗ gọi không có khái niệm level).
     * Avatar KHÔNG bị khoá theo level (chỉ Frame có cơ chế khoá), nên luôn random tự do.
     */
    getRandomAvatarURL(level?: number){
        // Bản gốc tính random xong lại bỏ qua, luôn trả cố định "0_0" (dòng return thật bị comment)
        // — khiến mọi bot trong bảng xếp hạng dùng chung avatar/frame số 0. lodash.random(min,max)
        // lấy CẢ 2 đầu (inclusive) nên trừ 1 ở cận trên để không random ra ID vượt quá mảng.
        let avatar:number = this.avatarDataDetails[lodash.random(0, this.avatarDataDetails.length - 1)].Id;
        let frame:number = this.getRandomUnlockedFrameID(level);
        return avatar+"_"+frame;
    }

    private getRandomUnlockedFrameID(level?: number): number {
        if (level == null) {
            return this.frameDataDetails[lodash.random(0, this.frameDataDetails.length - 1)].Id;
        }
        const unlocked = this.frameDataDetails.filter((f) => (f.levelRequire ?? 0) <= level);
        // frameDataDetails[0] luôn có levelRequire=0 (mở sẵn) nên unlocked hiếm khi rỗng, nhưng
        // vẫn fallback về ID 0 cho chắc nếu profileData.json bị chỉnh sai (mọi frame đều khoá).
        if (unlocked.length === 0) return this.frameDataDetails[0]?.Id ?? 0;
        return unlocked[lodash.random(0, unlocked.length - 1)].Id;
    }

    getRandomName(){
        const idx = lodash.random(0, this.DEFAULT_PLAYER_NAMES.length);
        return this.DEFAULT_PLAYER_NAMES[idx];
    }

    DEFAULT_PLAYER_NAMES:string[]=[
        "James",
        "Olivia",
        "Liam",
        "Emma",
        "Noah",
        "Ava",
        "William",
        "Sophia",
        "Benjamin",
        "Isabella",
        "Elijah",
        "Mia",
        "Lucas",
        "Charlotte",
        "Mason",
        "Amelia",
        "Ethan",
        "Harper",
        "Alexander",
        "Evelyn",
        "Henry",
        "Abigail",
        "Daniel",
        "Scarlett",
        "Matthew",
        "Lily",
        "Jackson",
        "Grace",
        "David",
        "Chloe",
        "Joseph",
        "Victoria",
        "Samuel",
        "Emily",
        "Anthony",
        "Natalie",
        "Andrew",
        "Hannah",
        "Christopher",
        "Madison",
        "Joshua",
        "Aria",
        "Gabriel",
        "Penelope",
        "Nicholas",
        "Eleanor",
        "Dylan",
        "Zoey",
        "Caleb",
        "Stella",
        "Nathan",
        "Hazel",
        "Levi",
        "Aurora",
        "Ryan",
        "Lucy",
        "Christian",
        "Nora",
        "Isaac",
        "Ellie",
        "Julian",
        "Savannah",
        "Owen",
        "Leah",
        "Adam",
        "Skylar",
        "Aaron",
        "Bella",
        "Thomas",
        "Violet",
        "Charles",
        "Addison",
        "Hunter",
        "Paisley",
        "Jonathan",
        "Autumn",
        "Sebastian",
        "Caroline",
        "Zachary",
        "Claire",
        "Grayson",
        "Lillian",
        "Jaxon",
        "Maya",
        "Isaiah",
        "Everly",
        "Lincoln",
        "Kennedy",
        "Ezra",
        "Sadie",
        "Jordan",
        "Peyton",
        "Weston",
        "Hailey",
        "Nathaniel",
        "Elena",
        "Dominic",
        "Alice",
        "Xavier",
        "Julia"
    ];

}

export enum PROFILE_TAB_TYPE{
  AVATAR = 0,
  FRAME = 1
}
Enum(PROFILE_TAB_TYPE);
