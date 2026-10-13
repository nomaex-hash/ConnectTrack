// @ts-nocheck
import { _decorator, CCInteger, Component, instantiate, Node, Prefab, ScrollView, Size, UITransform, Vec3 } from 'cc';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { ItemLeaderboardEntryBase } from '../common/ItemLeaderboardEntryBase';
const { ccclass, property } = _decorator;

@ccclass('LeaderBoardGroupBaseManager')
export class LeaderBoardGroupBaseManager extends Component {
    arrItemRankInfos: ItemRankInfo[] = [];
    @property(Node)
    contentGroup: Node;

    @property(Prefab)
    itemLeaderBoardPrefab: Prefab;

    @property(CCInteger)
    countShowItem: number = 18;

    @property(CCInteger)
    KC_Y: number = 0;

    @property(CCInteger)
    SIZE_ITEM: number = 123;

    @property(CCInteger)
    CONTENT_HIGHT: number = 800;

    @property(CCInteger)
    CONTENT_WIDTH: number = 720;

    // @property(CCInteger)
    posYStart: number = 400;

    @property(CCInteger)
    BOTTOM:number = 200;


    arrPoolItems: ItemLeaderboardEntryBase[] = [];
    mapItemBoards: Map<number, ItemLeaderboardEntryBase> = new Map();

    @property(ScrollView)
    scrollView: ScrollView;

    @property(ItemLeaderboardEntryBase)
    myItemLeaderBoard: ItemLeaderboardEntryBase = null;

    indexMyRank: number = -1;
    isShowMyRank: boolean = false;


    protected onEnable(): void {

        if (!this.scrollView) return;
        this.scrollView.node.on(ScrollView.EventType.SCROLLING,this.setScrollEvent,this);

        this.CONTENT_HIGHT = this.scrollView.node.getComponent(UITransform).height;
        this.posYStart = this.CONTENT_HIGHT / 2;
    }

    protected onDisable(): void {
        if (!this.scrollView) return;
        this.scrollView.node.off(ScrollView.EventType.SCROLLING,this.setScrollEvent,this);
    }

    /** Trả về Promise xong khi showInitRank() (override ở lớp con, ví dụ
     * LeaderBoardGroupRewardManager) báo đã tải xong avatar/frame — mặc định (lớp này) không tự
     * dựng item nào (showInitRank() rỗng) nên resolve ngay. */
    initRankGroup(_arrItemRewardInfos:ItemRankInfo[]): Promise<void> {
        if (!this.scrollView || !this.contentGroup) return Promise.resolve();

        if(this.myItemLeaderBoard){
            this.myItemLeaderBoard.node.active = false;
        }
        this.resetRankGroup();

        this.arrItemRankInfos = _arrItemRewardInfos;
        if(this.arrItemRankInfos.length == 0) return Promise.resolve();

        let maxY:number = (this.SIZE_ITEM + this.KC_Y) * _arrItemRewardInfos.length + this.BOTTOM;
        this.contentGroup.getComponent(UITransform).setContentSize(new Size(this.CONTENT_WIDTH,maxY));
        this.contentGroup.setPosition(new Vec3(0,this.posYStart,0));
        this.scrollView.scrollToTop();

        if(this.myItemLeaderBoard){
            this.indexMyRank = this.arrItemRankInfos.findIndex(item => item.isMyRank == true);
        }


        return this.showInitRank() ?? Promise.resolve();
    }

    /** Gọi lại showItem() (tween "bung ra" opacity+scale) trên MỌI dòng đang dựng + dòng "tôi" —
     * dùng khi dòng đã được init() TỪ LÚC CÒN ẨN (tween đầu đã chạy xong âm thầm trong lúc ẩn,
     * xem LeaderboardGroupWeek.receiveListRankLeaderboard()) để tween THẬT SỰ chạy trên màn hình
     * đúng lúc danh sách vừa hiện ra. */
    replayEntrance(): void {
        this.mapItemBoards.forEach(item => item.showItem());
        if (this.myItemLeaderBoard?.node.active) this.myItemLeaderBoard.showItem();
    }

    resetRankGroup(){
        if (!this.scrollView || !this.contentGroup) return;
        if(this.myItemLeaderBoard){
            this.myItemLeaderBoard.node.active = false;
        }

        this.contentGroup.destroyAllChildren();
        this.arrPoolItems = [];
        this.mapItemBoards.clear();
        this.scrollView.stopAutoScroll();
        this.arrItemRankInfos = [];
    }

    getPos_byIndex(_index:number){
        let posY:number = -this.SIZE_ITEM/2 - _index * (this.SIZE_ITEM + this.KC_Y);
        return new Vec3(0,posY,0);
    }

    showInitRank(){

    }

    lastIndexPosCenter:number = -1;
    setScrollEvent() {
        let indexPosCenter: number = Math.floor((this.contentGroup.position.y - this.posYStart + this.CONTENT_HIGHT / 2) / (this.SIZE_ITEM + this.KC_Y));
        if (this.lastIndexPosCenter == indexPosCenter) return;
        this.lastIndexPosCenter = indexPosCenter;
        this.mapItemBoards.forEach(itemLeaderBoard => {
            if (itemLeaderBoard.node.active) {
          
                if (itemLeaderBoard.indexPos < indexPosCenter - this.countShowItem / 2 || itemLeaderBoard.indexPos > indexPosCenter + this.countShowItem / 2) {
                    itemLeaderBoard.node.active = false;
                    this.mapItemBoards.delete(itemLeaderBoard.indexPos);
                }
            }
        });

        let value: number = Math.floor(this.countShowItem / 2);
        for (let i = -value; i < value + 1; i++) {
            let indexPos: number = i + indexPosCenter;
            if (indexPos >= 0 && indexPos < this.arrItemRankInfos.length) {
                if (this.mapItemBoards.has(indexPos)) {
                    let itemBoard: ItemLeaderboardEntryBase = this.mapItemBoards.get(indexPos);
                    if (!itemBoard.node.active) {
                        itemBoard.node.active = true;
                    }
                } else {
                 
                    this.updateItemRank(indexPos);
                }
            }
        }

        if (this.indexMyRank > -1) {
            if (this.mapItemBoards.has(this.indexMyRank) && this.isShowMyRank) {
                // console.log("HIDE");
                this.isShowMyRank = false;
                this.myItemLeaderBoard.node.active = false;
            } else if (!this.mapItemBoards.has(this.indexMyRank) && !this.isShowMyRank) {
                // console.log("SHOW");
                this.isShowMyRank = true;
                this.myItemLeaderBoard.node.active = true;
            }
        }
    }

    getItemLeaderBoard_Recycle_FromPools() {
        if (!this.itemLeaderBoardPrefab || !this.contentGroup) return null;
        for (let i = 0; i < this.arrPoolItems.length; i++) {
            if (!this.arrPoolItems[i].node.active) {
                return this.arrPoolItems[i];
            }
        }
        let item = instantiate(this.itemLeaderBoardPrefab);
        item.setParent(this.contentGroup);
        let itemLeaderBoard: ItemLeaderboardEntryBase = item.getComponent(ItemLeaderboardEntryBase);
        this.arrPoolItems.push(itemLeaderBoard);
        return itemLeaderBoard;
    }

    updateItemRank(indexPos: number) {
        
    }
}


