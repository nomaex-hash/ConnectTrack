// @ts-nocheck
// Component MỚI, TÁCH RIÊNG khỏi LeaderBoardGroupBaseManager (tab Weekly thật) theo quyết định đã
// chốt — tránh sửa vào hệ thống đang chạy ổn định cho tab Weekly. Dùng LẠI đúng data
// (LegacyLeaderboardManager) và đúng prefab hàng (ItemLeaderboardEntryNormal) để nhìn giống hệt
// tab Weekly, nhưng tự quản lý vị trí/animation leo hạng riêng.
//
// MÔ HÌNH ANIMATION (v3 — 3 pha, xem chi tiết ở play()):
// 0) Giữ yên ở vị trí CŨ (đáy view) initialHoldSeconds giây.
// 1) "Nhấc lên": hàng "tôi" scale to lên (liftScale).
// 2) "ScrollView cuộn xuống": hàng "tôi" GHIM CỐ ĐỊNH tại 1 vị trí trên MÀN HÌNH (không tự di
//    chuyển) trong khi ScrollView tự cuộn nội dung bên dưới nó, cho tới khi kịch biên (không cuộn
//    thêm được nữa). Bot KHÔNG BAO GIỜ đổi thứ tự tương đối với nhau — chỉ bot nằm trong "vùng bị
//    vượt qua" (natural rank từ newRank đến oldRank-1) dịch xuống ĐÚNG 1 ô để nhường chỗ, kèm hiệu
//    ứng "giãn ra rồi khép lại", rải đều theo đúng thứ tự "tôi" lướt qua.
// 3) Nếu cuộn đã kịch biên (topRanksSkipBottomAnchor) mà "tôi" vẫn chưa khớp đúng vị trí hạng mới
//    (vì gần Top 1 không được canh đáy) — hàng "tôi" tự di chuyển nốt quãng còn lại.
// 4) "Đập xuống": scale nhỏ hơn gốc rồi hồi lại scale gốc.
import { _decorator, Component, Node, ParticleSystem, Prefab, ScrollView, Sprite, UIOpacity, UITransform, Vec3, Widget, instantiate, tween, Tween } from 'cc';
import { ItemRankInfo } from '../../common/ItemRankInfo';
import { ItemLeaderboardEntryBase } from '../../common/ItemLeaderboardEntryBase';
import { ItemLeaderboardTop } from '../../leaderboard/ItemLeaderboardTop';
import { ItemLeaderboardGroupReward } from '../../leaderboard/ItemLeaderboardGroupReward';
import { DetailRewardGroup } from '../../common/DetailRewardGroup';
import { AVATAR_TYPE, Constants } from '../../framework/constants';
import { clientEvent } from '../../framework/clientEvent';
import { ProfileManager } from '../../profile/ProfileManager';
import { LeaderboardManager as LegacyLeaderboardManager } from '../../leaderboard/LeaderboardManager';
import { LeaderboardHeartFlyEffect } from './LeaderboardHeartFlyEffect';
import { climbSegmentDuration, climbSegmentEasing, climbTimeForDistance } from './climbMotion';
const { ccclass, property } = _decorator;

const MAX_FLY_HEARTS = 10;
const SCORE_BUMP_SCALE = 1.3;

interface RankRow {
    rank: number;
    node: Node;
    item: ItemLeaderboardEntryBase;
}

@ccclass('LeaderboardPreviewManager')
export class LeaderboardPreviewManager extends Component {
    @property(ScrollView)
    scrollView: ScrollView = null;

    @property(Node)
    contentGroup: Node = null;

    @property({ type: Prefab, tooltip: 'Prefab 1 hàng — dùng ItemLeaderBoardNormal.prefab để nhìn giống hệt tab Weekly.' })
    itemPrefab: Prefab = null;

    @property({ tooltip: 'Chiều cao 1 hàng (khớp SIZE_ITEM của tab Weekly thật = 100).' })
    sizeItem = 100;

    @property({ tooltip: 'Khoảng cách giữa 2 hàng (khớp KC_Y của tab Weekly thật = 11).' })
    gapY = 11;

    @property({ tooltip: 'Số hàng LỘ RA trong khung nhìn (viewport) — dùng để tính scroll-follow/canh neo.' })
    visibleRows = 5;

    @property({
        range: [0, 1, 0.01],
        slide: true,
        tooltip:
            'Vị trí NEO hàng "tôi" trong khung nhìn lúc ScrollView tự cuộn theo (leo hạng) — 0 = neo ' +
            'sát mép TRÊN, 1 = neo sát mép DƯỚI, 0.5 = neo GIỮA (mặc định).',
    })
    playerAnchorRatio = 0.5;

    @property({ tooltip: 'Số hàng RESIDENT tối đa được giữ dựng sẵn cùng lúc (giống countShowItem của tab Weekly) — cuộn ra ngoài khoảng này sẽ bị thu hồi (recycle), cuộn tới đâu mới dựng thêm tới đó. Chỉ áp dụng SAU khi animation leo hạng đã xong.' })
    countShowItem = 8;

    @property({ tooltip: 'Nếu hạng của tôi (sau khi leo xong) nằm trong Top N này thì KHÔNG ép canh neo (playerAnchorRatio) nữa — cứ hiện tự nhiên từ trên xuống.' })
    topRanksSkipBottomAnchor = 6;

    @property({ tooltip: 'Thời gian leo qua 1 hạng (giây) — CHỈ dùng để tính climbSpeedMax đạt được ở hạng nào (xem climbSpeedMin/Max), không còn trực tiếp quyết định tổng thời gian animation nữa.' })
    stepDuration = 0.35;

    @property({
        tooltip:
            'Trần tối đa cho tổng thời gian leo hạng (giây) khi leo ÍT hạng nhất (k=1) — cùng với ' +
            'stepDuration, xác định mốc số hạng mà tốc độ bay đạt climbSpeedMax (xem ghi chú ' +
            'climbSpeedMin/climbSpeedMax). Leo càng nhiều hạng thì càng nhanh đạt/vượt mốc này.',
    })
    maxClimbDuration = 2;

    @property({
        tooltip:
            'Tốc độ bay (px/giây) khi leo RẤT ÍT hạng (k=1) — tốc độ tăng dần tuyến tính theo số ' +
            'hạng phải bay qua, đạt climbSpeedMax ở mốc hạng = maxClimbDuration/stepDuration (xem ' +
            'computeClimbSpeed()). Áp dụng CHUNG cho cả pha ScrollView cuộn lẫn hàng "tôi" tự bay bù.',
    })
    climbSpeedMin = 300;

    @property({ tooltip: 'Tốc độ bay (px/giây) TỐI ĐA — không bao giờ vượt quá, dù leo bao nhiêu hạng.' })
    climbSpeedMax = 900;

    @property({
        min: 0,
        tooltip:
            'Thời gian TĂNG TỐC (giây): vận tốc tăng ĐỀU từ 0 lên tốc độ bay (đã tính theo số hạng, xem ' +
            'climbSpeedMin/climbSpeedMax) rồi giữ nguyên — tránh bị "giật" vì bật tốc độ ngay lúc bắt đầu leo. ' +
            'Tính từ lúc BẮT ĐẦU bay, dùng chung cho cả pha cuộn lẫn pha hàng "tôi" tự bay (không tăng tốc lại ' +
            'từ 0 ở pha sau). Càng lớn càng mượt nhưng tổng thời gian leo cũng dài thêm ~ nửa giá trị này. ' +
            '0 = bật tốc độ ngay như cũ.',
    })
    climbAccelSeconds = 0.5;

    @property({ tooltip: 'Thời gian các hàng bị vượt tách ra (dịch xuống 1 ô) — hàng "tôi" dừng chờ đúng khoảng này trước khi đập xuống (giây).' })
    separateSeconds = 0.25;

    @property({ tooltip: 'Thời gian đứng yên ở vị trí CŨ (đáy view) trước khi tim bay vào / bắt đầu leo hạng (giây).' })
    initialHoldSeconds = 2;

    @property({
        type: LeaderboardHeartFlyEffect,
        tooltip: 'Hiệu ứng tim bay vào số tim của dòng "tôi" lúc vừa thắng. Trống = bỏ qua hiệu ứng, số tim cập nhật ngay.',
    })
    heartFlyEffect: LeaderboardHeartFlyEffect | null = null;

    @property({
        type: Node,
        tooltip: 'Điểm xuất phát của tim bay (vd 1 node nằm dưới khung danh sách). Trống = giữa mép dưới ScrollView.',
    })
    heartFlyStartNode: Node | null = null;

    @property({
        tooltip:
            'Khoảng cách (px) từ mép TRÁI màn hình THẬT tới heartFlyStartNode — script tự tính lại ' +
            'đúng vị trí này mỗi lần bay tim (bỏ qua Left đã set sẵn trong Editor trên Widget của ' +
            'node đó, vốn tính sai theo 1 node cha nhỏ thay vì màn hình thật). Chỉ áp dụng khi ' +
            'heartFlyStartNode có gán component Widget.',
    })
    heartFlyStartLeftMargin = 40;

    @property({ tooltip: 'Nghỉ 1 nhịp sau khi tim cuối cùng bay tới nơi, trước khi bắt đầu leo hạng (giây).' })
    postHeartGainSeconds = 0.3;

    @property({ tooltip: 'Scale khi hàng "tôi" được "nhấc lên" lúc bắt đầu leo.' })
    liftScale = 1.15;

    @property({ tooltip: 'Thời gian nhấc lên (giây).' })
    liftDuration = 0.2;

    @property({ tooltip: 'Scale lúc "đập xuống" (nhỏ hơn scale gốc) trước khi hồi lại scale gốc.' })
    thudSquashScale = 0.85;

    @property({
        type: [ItemLeaderboardTop],
        tooltip:
            'Bục TOP3 TĨNH nằm NGOÀI ScrollView (giống hệt tab Leaderboard chính, xem LeaderboardGroupWeek) ' +
            '— ĐÚNG 3 phần tử theo thứ tự [hạng 1, hạng 2, hạng 3]. Copy nguyên node TOP3 từ ' +
            'LeaderboardTabGroup.prefab vào prefab popup này rồi kéo 3 node con top1/top2/top3 vào đây. ' +
            'Để TRỐNG thì giữ nguyên hành vi CŨ (hạng 1-3 vẫn nằm trong ScrollView như trước, không tách ra).',
    })
    topSlots: ItemLeaderboardTop[] = [];

    @property({
        type: DetailRewardGroup,
        tooltip:
            'Bảng chi tiết thưởng hiện khi bấm hộp quà ở bục TOP3 — copy nguyên node DetailRewardGroup ' +
            'từ LeaderboardTabGroup.prefab vào prefab popup này (đặt NGOÀI vùng bị ScrollView Mask cắt). ' +
            'Mỗi node top1/top2/top3 (ItemLeaderboardTop.groupReward.parentDetailRewardGroup) PHẢI trỏ ' +
            'lại đúng 1 node trong CHÍNH prefab popup này (không phải node cũ bên LeaderboardTabGroup) — ' +
            'ví dụ chính node TOP3. Để trống thì hộp quà TOP3 bấm không có phản hồi gì.',
    })
    detailRewardGroup: DetailRewardGroup | null = null;

    @property({
        type: Node,
        tooltip:
            'Node CHA chứa SẴN 4 particle con (tự sắp xếp/lệch hướng trong Editor) — bắn ĐỒNG THỜI ' +
            'cả 4 ĐÚNG lúc hàng "tôi" trong ScrollView đập xuống đúng vị trí cuối cùng (playThud). ' +
            'Script tự di chuyển CẢ NODE CHA này tới world position của hàng rồi play() từng particle ' +
            'con (getComponentsInChildren) — không cần gán riêng từng particle. Để trống thì bỏ qua, ' +
            'không crash.',
    })
    scrollRowLandParticleGroup: Node | null = null;

    @property({ tooltip: 'Lệch NGANG (px) scrollRowLandParticleGroup so với tâm hàng "tôi" lúc đập xuống. Dương = dịch sang phải.' })
    scrollRowLandParticleOffsetX = 0;

    @property({ tooltip: 'Lệch DỌC (px) scrollRowLandParticleGroup so với tâm hàng "tôi" lúc đập xuống. Dương = dịch LÊN, âm = dịch XUỐNG.' })
    scrollRowLandParticleOffsetY = 0;

    @property({
        type: Sprite,
        tooltip:
            'Viền vàng NHÁY lên ĐÚNG lúc hàng "tôi" trong ScrollView đập xuống — CÙNG LÚC với ' +
            'scrollRowLandParticle (playThud). Mờ→đậm rồi mờ dần tắt (opacity), tự căn theo world ' +
            'position + kích thước hàng lúc đó. Để trống thì bỏ qua, không crash.',
    })
    scrollRowLandBorder: Sprite | null = null;

    @property({ tooltip: 'Viền vàng đập xuống: thời gian mờ dần HIỆN lên (giây), bắt đầu ngay lúc đập xuống.' })
    landBorderFadeInSeconds = 0.08;

    @property({ tooltip: 'Viền vàng đập xuống: đứng yên đậm hẳn bao lâu (giây) trước khi mờ dần tắt.' })
    landBorderHoldSeconds = 0.1;

    @property({ tooltip: 'Viền vàng đập xuống: thời gian mờ dần TẮT (giây).' })
    landBorderFadeOutSeconds = 0.25;

    @property({
        tooltip:
            'Lệch NGANG (px) so với tâm hàng — chỉnh nếu viền lệch trái/phải so với dòng hạng. ' +
            'Dương = dịch sang phải.',
    })
    landBorderOffsetX = 0;

    @property({
        tooltip:
            'Lệch DỌC (px) so với tâm hàng — chỉnh nếu viền cao/thấp hơn dòng hạng (bug đã báo: ' +
            'viền đang cao hơn 1 chút). Dương = dịch LÊN, âm = dịch XUỐNG.',
    })
    landBorderOffsetY = 0;

    @property({
        type: ParticleSystem,
        tooltip:
            'Particle bắn ra ĐÚNG lúc cụm avatar+frame "tôi" ở bục TOP3 đập xuống đúng vị trí — áp ' +
            'dụng cho CẢ 2 trường hợp (vào top3 từ ngoài lẫn leo hạng nội bộ trong top3), tự căn theo ' +
            'world position của bục lúc đó. Để trống thì bỏ qua, không crash.',
    })
    topSlotLandParticle: ParticleSystem | null = null;

    @property({ tooltip: 'topSlotLandParticle: chạy đúng bao lâu (giây) rồi tự tắt hẳn, không đợi particle tự hết theo cấu hình riêng của nó.' })
    topSlotLandParticleDuration = 0.5;

    @property({ tooltip: 'Lệch NGANG (px) topSlotLandParticle so với tâm bục TOP3 lúc đập xuống. Dương = dịch sang phải.' })
    topSlotLandParticleOffsetX = 0;

    @property({ tooltip: 'Lệch DỌC (px) topSlotLandParticle so với tâm bục TOP3 lúc đập xuống. Dương = dịch LÊN, âm = dịch XUỐNG.' })
    topSlotLandParticleOffsetY = 0;

    @property({
        type: ParticleSystem,
        tooltip:
            'Particle hiện SUỐT từ lúc tim vừa bay vào score xong (qua cả "nhấc lên" lẫn pha di ' +
            'chuyển), tới ngay TRƯỚC khi "đập xuống"/biến mất vào bục TOP3 — KHÔNG hiện lúc đập ' +
            'xuống. Node này tự làm CON TẠM THỜI của hàng "tôi" (gỡ ra ngay khi dừng) nên tự bị ' +
            'ScrollView Mask che y hệt hàng khi hàng ra khỏi khung nhìn (leo vào bục TOP3). Để trống ' +
            'thì bỏ qua, không crash.',
    })
    scrollRowMoveParticle: ParticleSystem | null = null;

    @property({
        tooltip:
            'Lệch NGANG (px) của particle di chuyển so với TÂM hàng "tôi" — particle là CON của ' +
            'hàng nên đây là local position, dương = dịch sang phải.',
    })
    moveParticleOffsetX = 0;

    @property({
        tooltip:
            'Lệch DỌC (px) của particle di chuyển so với TÂM hàng "tôi" — particle là CON của hàng ' +
            'nên đây là local position, dương = dịch LÊN, âm = dịch XUỐNG.',
    })
    moveParticleOffsetY = 0;

    private lastRewardDetailSource: ItemLeaderboardGroupReward | null = null;

    @property({ tooltip: 'Bay quá mép trên khung nhìn thêm bao nhiêu HÀNG (không phải giây) trước khi hàng "tôi" biến mất hẳn — đảm bảo chắc chắn đã khuất dưới Mask trước khi gỡ.' })
    flyPastViewportExtraRows = 1;

    @property({ tooltip: 'Cụm avatar "tôi" xuất hiện DƯỚI vị trí bục đúng bao nhiêu px trước khi trượt lên.' })
    topSlotRiseDistance = 60;

    @property({ tooltip: 'Scale cụm avatar "tôi" lúc vừa hiện dưới bục (to hơn scale gốc — giống hiệu ứng "rơi xuống" từ trên).' })
    topSlotEnterScale = 1.3;

    @property({ tooltip: 'Thời gian cụm avatar "tôi" trượt từ dưới lên đúng vị trí bục (giây).' })
    topSlotRiseSeconds = 0.25;

    @property({ tooltip: 'Scale LÚN khi cụm avatar "tôi" đập xuống đúng bục (nhỏ hơn 1 một chút) trước khi hồi lại scale gốc — cùng ý tưởng dogPopSquashScale của CellView.' })
    topSlotSquashScale = 0.92;

    @property({ tooltip: 'Thời gian đập xuống + lún (giây) khi cụm avatar "tôi" tới đúng bục.' })
    topSlotSquashSeconds = 0.12;

    @property({ tooltip: 'Thời gian hồi lại scale gốc SAU khi lún (giây).' })
    topSlotSettleSeconds = 0.1;

    @property({ tooltip: 'Thời gian fade+scale ra/vào (mỗi chiều) của cụm avatar cũ/mới ở 2 bục CÒN LẠI (giây).' })
    topSlotSwapFadeSeconds = 0.15;

    @property({ tooltip: 'Dừng thêm (giây) SAU KHI "tôi" đập xuống bục xong, TRƯỚC KHI 2 bục còn lại đổi sang đúng bot.' })
    topSlotOthersSwapDelaySeconds = 0.1;

    @property({
        tooltip:
            'Leo hạng NGAY TRONG NỘI BỘ Top3 (đã ở top3 sẵn từ đầu, leo lên hạng tốt hơn CŨNG trong ' +
            'top3, ví dụ hạng 3 lên hạng 1) — dừng thêm bao nhiêu giây TRƯỚC KHI bắt đầu cả chuỗi ' +
            '(nhấc lên/bay/đập xuống), tính từ lúc tim bay vào xong.',
    })
    topSlotClimbStartDelaySeconds = 0.3;

    @property({ tooltip: 'Leo hạng nội bộ Top3: scale lúc "nhấc lên" avatar+frame "tôi" trước khi bay sang bục đúng (giống liftScale của ScrollView).' })
    topSlotClimbLiftScale = 1.15;

    @property({ tooltip: 'Leo hạng nội bộ Top3: thời gian "nhấc lên" (giây).' })
    topSlotClimbLiftSeconds = 0.15;

    @property({ tooltip: 'Leo hạng nội bộ Top3: thời gian avatar+frame "tôi" bay từ bục CŨ sang đúng vị trí bục MỚI (giây).' })
    topSlotClimbFlySeconds = 0.4;

    @property({
        tooltip:
            'Bục TOP3: khoảng poll (giây) kiểm tra avatar/frame đã tải ẢNH xong chưa (loadAvatar() ' +
            'bất đồng bộ) TRƯỚC KHI chạy hiệu ứng hiện lên (fade/rơi xuống/bay tới) — tránh hiện ' +
            'cụm TRẮNG (ảnh chưa kịp tải) rồi ảnh mới "hiện ra" đột ngột giữa/sau khi hiệu ứng đã ' +
            'chạy xong (bug đã báo, kèm ảnh).',
    })
    topSlotAvatarLoadPollSeconds = 0.05;

    @property({
        tooltip:
            'Bục TOP3: chờ tối đa bao lâu (giây) avatar/frame tải ảnh xong trước khi CHẠY TIẾP hiệu ' +
            'ứng hiện lên dù ảnh có thể vẫn chưa tải xong — tránh kẹt mãi mãi nếu tải lỗi/mạng chậm.',
    })
    topSlotAvatarLoadTimeoutSeconds = 1.5;


    private arrItemRankInfos: ItemRankInfo[] = [];

    /** Promise avatar/frame của các item dựng lúc MỞ popup (buildTopSlots + spawnRow trong
     * buildAnimationWindow gọi lúc play()) — xác nhận từ user: "đợi load xong mới cho mở, không thì
     * vẫn dùng icon loading". Reset mỗi lần play() chạy lại; KHÔNG gồm các lần đổi data giữa chừng
     * lúc climb đang chạy (applySlotDataInstant) — đó không phải "lần đầu mở". */
    private pendingAvatarLoads: Promise<void>[] = [];

    /** Callback ĐỒNG BỘ, gọi NGAY TRONG CÙNG lệnh .then() của Promise.all(pendingAvatarLoads) — tham
     * khảo ĐÚNG pattern readyCallbacks/onReady() của LeaderboardGroupWeek/LeaderboardTabGroupManager
     * (xác nhận từ user: "loading ở leaderboardPreview hãy tham khảo cách load của leaderboard") —
     * KHÔNG để LeaderboardPreviewPopup tự thêm 1 lớp `.then()` RIÊNG của chính nó bọc ra ngoài nữa
     * (đúng BUG đã sửa ở LeaderboardPopup trước đây: mỗi lớp `.then()` lồng thêm là +1 microtask trễ
     * so với lúc dữ liệu thật sự sẵn sàng — "icon loading vẫn xoay nhưng nội dung đã hiện" chính là
     * hệ quả của độ trễ dồn lại đó). Reset mỗi lần play() chạy lại, CÙNG lúc với pendingAvatarLoads. */
    private avatarReadyCallbacks: (() => void)[] = [];

    /** @deprecated BUG đã sửa (xác nhận từ user — lặp lại đúng bug "icon loading tắt trễ/sai nhịp"
     * đã gặp và sửa ở LeaderboardTabGroupManager.whenLeaderboardReady()): dùng onAvatarsReady()
     * (callback đồng bộ) thay vào đó — Promise trả về đây LUÔN trễ thêm 1 microtask so với lúc
     * avatarReadyCallbacks thật sự chạy, vì mọi `.then()` của CHÍNH caller lại cộng thêm 1 microtask
     * nữa. Giữ lại chỉ để không phá vỡ chỗ nào lỡ còn gọi trực tiếp. */
    whenAvatarsReady(): Promise<void> {
        return new Promise(resolve => this.onAvatarsReady(resolve));
    }

    /** Đăng ký callback ĐỒNG BỘ, chạy CÙNG lệnh với lúc toàn bộ pendingAvatarLoads của lần play()
     * GẦN NHẤT đã tải xong hết — xem avatarReadyCallbacks. Gọi NGAY nếu không còn gì đang tải (vd
     * play() vừa return sớm do thiếu node bắt buộc). */
    onAvatarsReady(callback: () => void): void {
        if (this.pendingAvatarLoads.length === 0) {
            callback();
            return;
        }
        this.avatarReadyCallbacks.push(callback);
    }

    /** Gọi ĐÚNG 1 LẦN khi Promise.all(pendingAvatarLoads) của lần play() hiện tại resolve — xem
     * play(). Tự bỏ qua nếu 1 lần play() MỚI đã chạy đè lên (so sánh snapshot mảng) trước khi lần
     * CŨ kịp tải xong, tránh gọi callback của phiên đã lỗi thời. */
    private resolveAvatarsReady(snapshot: Promise<void>[]): void {
        if (this.pendingAvatarLoads !== snapshot) return;
        const callbacks = this.avatarReadyCallbacks;
        this.avatarReadyCallbacks = [];
        for (const callback of callbacks) callback();
    }

    @property({
        type: [Node],
        tooltip:
            'CÁC NODE PHẢI ẨN HẲN (active=false) cho tới khi avatar/frame đã tải xong và ổn định — ' +
            'y hệt hideUntilLoaded của LeaderboardTabGroupManager (xác nhận từ user: "ở leaderboard ' +
            'có 1 property là hide until loaded, thêm 1 cái giống hệt cho leaderboardPreview"). Tự ' +
            'ẩn NGAY lúc play() bắt đầu, tự hiện lại NGAY lúc onAvatarsReady() báo đã tải xong hết ' +
            '(callback ĐỒNG BỘ, không qua Promise — cùng lý do với onAvatarsReady()).',
    })
    hideUntilLoaded: Node[] = [];

    private rows: Map<number, RankRow> = new Map();
    private pool: Node[] = [];

    private totalRanks = 0;
    private climbing = false;
    private climbOldRank = 0;
    private lastCenterRank = -1;

    /** Số hạng bị "cắt" khỏi không gian toạ độ ScrollView vì đã chuyển sang bục TOP3 tĩnh — 3 nếu
     * topSlots đã gán đủ 3 phần tử, 0 nếu chưa gán (giữ nguyên hành vi cũ, hạng 1-3 vẫn nằm trong
     * ScrollView). Mọi hàm tính toạ độ Y trong ScrollView (yForRank/computeScrollTargetY) TRỪ ĐI
     * giá trị này để hạng 4 luôn là hàng ĐẦU TIÊN của ScrollView khi có TOP3 tĩnh. */
    private rankOffset = 0;


    private pinnedPlayerNode: Node | null = null;
    /** Đối tượng trung gian cho tween cuộn của pha ScrollView (value 0..1 = tiến độ quãng đường đã cuộn). */
    private climbScrollProxy: { value: number } | null = null;
    private pinnedAnchorSlotConstant = 0;

    /** Cha + sibling index GỐC của scrollRowMoveParticle trước khi tạm làm con hàng "tôi" — khôi
     * phục lại đúng lúc dừng (xem startMoveParticle()/stopMoveParticle()). */
    private moveParticleOriginalParent: Node | null = null;
    private moveParticleOriginalSiblingIndex = -1;

    private get rowHeight(): number {
        return this.sizeItem + this.gapY;
    }

    protected onLoad(): void {
        if (this.scrollView) this.scrollView.elastic = false;
    }

    /** Bắn `particle` (nếu có gán) tại đúng `worldPos` — dùng cho topSlotLandParticle (particle ĐƠN
     * lẻ; particle nhóm scrollRowLandParticleGroup dùng playLandParticleGroup() riêng). Dừng/xoá
     * particle CŨ trước (phòng bắn liên tiếp quá nhanh) rồi phát lại từ đầu. `autoStopSeconds` (nếu
     * truyền) tự tắt hẳn particle sau đúng bấy nhiêu giây, không đợi particle tự hết theo cấu hình
     * riêng của nó — dùng cho topSlotLandParticle (xem topSlotLandParticleDuration). */
    /** Callback tắt particle ĐANG được hẹn giờ cho TỪNG particle (autoStopSeconds) — theo dõi riêng
     * mỗi particle để lần bắn SAU huỷ đúng lịch tắt của lần bắn TRƯỚC (phòng bắn liên tiếp quá
     * nhanh làm 2 lịch tắt chồng nhau). */
    private readonly pendingLandParticleStops = new Map<ParticleSystem, () => void>();

    private playLandParticle(particle: ParticleSystem | null, worldPos: Vec3, autoStopSeconds?: number): void {
        if (!particle) return;

        const pendingStop = this.pendingLandParticleStops.get(particle);
        if (pendingStop) {
            this.unschedule(pendingStop);
            this.pendingLandParticleStops.delete(particle);
        }

        particle.node.active = true;
        particle.node.setWorldPosition(worldPos);
        particle.stop();
        particle.clear();
        particle.play();

        if (autoStopSeconds !== undefined) {
            const stop = (): void => {
                particle.stop();
                particle.node.active = false;
                this.pendingLandParticleStops.delete(particle);
            };
            this.pendingLandParticleStops.set(particle, stop);
            this.scheduleOnce(stop, autoStopSeconds);
        }
    }

    /** worldPos CỘNG thêm topSlotLandParticleOffsetX/Y — dùng cho CẢ 2 chỗ bắn topSlotLandParticle. */
    private topSlotLandParticleWorldPos(base: Vec3): Vec3 {
        return new Vec3(base.x + this.topSlotLandParticleOffsetX, base.y + this.topSlotLandParticleOffsetY, base.z);
    }

    /** Di chuyển CẢ NODE CHA scrollRowLandParticleGroup tới đúng worldPos rồi bắn ĐỒNG THỜI toàn
     * bộ particle con (getComponentsInChildren) — vị trí/hướng lệch của từng particle con tự canh
     * sẵn (local position) ngay trong Editor, script không cần biết có bao nhiêu particle con. */
    private playLandParticleGroup(group: Node | null, worldPos: Vec3): void {
        if (!group) return;

        group.active = true;
        group.setWorldPosition(
            worldPos.x + this.scrollRowLandParticleOffsetX,
            worldPos.y + this.scrollRowLandParticleOffsetY,
            worldPos.z,
        );

        for (const particle of group.getComponentsInChildren(ParticleSystem)) {
            particle.stop();
            particle.clear();
            particle.play();
        }
    }

    /** Viền vàng "nháy 1 cái rồi tắt" (mờ→đậm→mờ dần, opacity) tại đúng `worldPos` — dùng cho
     * scrollRowLandBorder, chạy CÙNG LÚC với playLandParticle() trong playThud(). KHÔNG tự resize
     * theo kích thước hàng — đây là ảnh trang trí dạng "hoa gai" (starburst), kéo giãn contentSize
     * sẽ làm lệch tỉ lệ gai so với thiết kế gốc (bug đã báo, kèm ảnh: gai tràn ra ngoài 2 bên).
     * Mọi dòng trong ScrollView đều CÙNG 1 kích thước cố định nên không cần resize theo từng dòng —
     * chỉnh đúng kích thước viền 1 LẦN trong Editor cho khớp khung dòng là đủ.
     *
     * Scale "lún xuống rồi hồi lại" ĐỒNG BỘ với đúng tween của row.node ở playThud() (cùng
     * thudSquashScale/thời gian/easing) — tránh viền đứng yên trong khi hàng đang lún xuống, trông
     * như 2 hiệu ứng không ăn khớp nhau. */
    private playLandBorder(border: Sprite | null, worldPos: Vec3): void {
        if (!border) return;

        border.node.active = true;
        border.node.setWorldPosition(worldPos.x + this.landBorderOffsetX, worldPos.y + this.landBorderOffsetY, worldPos.z);

        Tween.stopAllByTarget(border.node);
        border.node.setScale(1, 1, 1);
        tween(border.node)
            .to(0.1, { scale: new Vec3(this.thudSquashScale, this.thudSquashScale, 1) }, { easing: 'quadOut' })
            .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        const opacity = border.node.getComponent(UIOpacity) ?? border.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;

        tween(opacity)
            .to(this.landBorderFadeInSeconds, { opacity: 255 })
            .delay(this.landBorderHoldSeconds)
            .to(this.landBorderFadeOutSeconds, { opacity: 0 })
            .call(() => {
                if (border.node.isValid) border.node.active = false;
            })
            .start();
    }

    /** Bật particle di chuyển ngay KHI TIM VỪA BAY VÀO XONG (runHeartGainPhase hoàn tất) — chạy
     * SUỐT cả pha "nhấc lên" lẫn pha di chuyển thật phía sau, tới tận lúc dừng hẳn (xem
     * stopMoveParticle()). Tạm làm CON của chính `row.node` (offset moveParticleOffsetX/Y) nên tự
     * bám theo mọi tween của hàng (scale lúc nhấc lên, di chuyển lúc scroll-pinned/tự bay) VÀ tự bị
     * ScrollView Mask che khi hàng ra khỏi khung nhìn, y hệt hàng — không cần đồng bộ vị trí thủ công. */
    private startMoveParticle(row: RankRow): void {
        const particle = this.scrollRowMoveParticle;
        if (!particle) return;

        const node = particle.node;
        this.moveParticleOriginalParent = node.parent;
        this.moveParticleOriginalSiblingIndex = node.parent ? node.getSiblingIndex() : -1;

        node.setParent(row.node);
        node.setPosition(this.moveParticleOffsetX, this.moveParticleOffsetY, 0);
        node.active = true;
        particle.stop();
        particle.clear();
        particle.play();
    }

    /** Tắt particle di chuyển + trả về ĐÚNG cha/sibling index gốc — gọi NGAY TRƯỚC thời điểm hàng
     * "tôi" dừng di chuyển thật (trước playThud() lẫn trước khi hàng biến mất/vào pool ở
     * runFlyPastViewport()), không để sót particle làm con 1 hàng đã bị pool tái dùng cho hạng khác. */
    private stopMoveParticle(): void {
        const particle = this.scrollRowMoveParticle;
        if (!particle) return;

        particle.stop();
        particle.clear();
        particle.node.active = false;

        if (this.moveParticleOriginalParent) {
            particle.node.setParent(this.moveParticleOriginalParent);
            particle.node.setSiblingIndex(this.moveParticleOriginalSiblingIndex);
        }
        this.moveParticleOriginalParent = null;
    }

    protected onEnable(): void {
        // cc.ParticleSystem mặc định playOnAwake=true — PHẢI tắt hẳn node mỗi lần popup này được
        // HIỆN LẠI (không chỉ lúc dựng lần đầu, xem lịch sử sửa đổi): popup này được UIManager POOL
        // lại (chỉ ẩn/hiện qua node.active, KHÔNG instantiate() lại, nên onLoad() không chạy lại) —
        // nếu để nguyên active=true từ lần play() trước, ParticleSystem.onEnable() sẽ tự bắn lại
        // NGAY LÚC popup vừa hiện lên (trước cả khi animation leo hạng kịp chạy tới), đúng bug đã
        // báo "particle hiện 1 lần trước khi hạng về đúng vị trí". Chỉ bật lại đúng lúc
        // playLandParticle() gọi tới (cùng cơ chế đã áp dụng cho placeDogParticle của CellView).
        if (this.scrollRowLandParticleGroup) this.scrollRowLandParticleGroup.active = false;
        if (this.topSlotLandParticle) this.topSlotLandParticle.node.active = false;
        if (this.scrollRowLandBorder) this.scrollRowLandBorder.node.active = false;
        if (this.scrollRowMoveParticle) this.scrollRowMoveParticle.node.active = false;

        this.scrollView?.node.on(ScrollView.EventType.SCROLLING, this.onScrolling, this);
        // clientEvent là event bus DÙNG CHUNG toàn app — tab Leaderboard chính (LeaderBoardGroupRewardManager)
        // cũng nghe ĐÚNG event này cho hộp quà scrollview/TOP3 của nó. showDetailRewardGroup() ở
        // đây tự lọc chỉ xử lý hộp quà thuộc CHÍNH 3 bục topSlots của popup này (xem bên dưới).
        clientEvent.on(Constants.LEADERBOARD_SHOW_DETAIL_REWARD, this.showDetailRewardGroup, this);
    }

    protected onDisable(): void {
        if (this.climbScrollProxy) {
            Tween.stopAllByTarget(this.climbScrollProxy);
            this.climbScrollProxy = null;
        }
        this.scrollView?.node.off(ScrollView.EventType.SCROLLING, this.onScrolling, this);
        clientEvent.off(Constants.LEADERBOARD_SHOW_DETAIL_REWARD, this.showDetailRewardGroup, this);
    }

    /** Bấm hộp quà ở bục TOP3 (ItemLeaderboardGroupReward.onTouchDetailReward, xem file đó) — hiện
     * CÙNG bảng chi tiết thưởng (DetailRewardGroup) mà tab Leaderboard chính đang dùng, reparent
     * tới đúng vị trí world của hộp quà vừa bấm (parentDetailRewardGroup — node NGOÀI Mask
     * ScrollView do CHÍNH ItemLeaderboardTop đó quyết định, xem doc ItemLeaderboardTop.groupReward).
     * Bỏ qua nếu hộp quà đó KHÔNG thuộc 3 bục topSlots của popup này (event dùng chung toàn app —
     * có thể là hộp quà từ tab Leaderboard chính nếu 2 bên tình cờ cùng active). */
    private showDetailRewardGroup = (itemLeaderboardGroupReward: ItemLeaderboardGroupReward): void => {
        if (!this.detailRewardGroup) return;
        if (!this.topSlots.some((slot) => slot?.groupReward === itemLeaderboardGroupReward)) return;

        const reparentTarget = itemLeaderboardGroupReward.parentDetailRewardGroup;
        if (!reparentTarget?.isValid) return;

        // CHẶN reparent tạo VÒNG LẶP cha-con (reparentTarget chính là detailRewardGroup.node, hoặc
        // là con/cháu của nó) — Cocos build lại cây transform sẽ đệ quy VÔ HẠN, treo cứng cả tab
        // trình duyệt (bug đã báo). Xảy ra khi field parentDetailRewardGroup của ItemLeaderboardTop
        // bị gán SAI (ví dụ còn trỏ prefab/node cũ, hoặc trỏ nhầm vào bên trong chính
        // DetailRewardGroup) — xem lại wiring trong Editor nếu thấy log cảnh báo này.
        if (reparentTarget === this.detailRewardGroup.node || reparentTarget.isChildOf(this.detailRewardGroup.node)) {
            console.warn(
                '[LeaderboardPreviewManager] parentDetailRewardGroup trỏ vào chính DetailRewardGroup ' +
                    'hoặc con/cháu của nó — bỏ qua để tránh treo máy (vòng lặp cha-con). Kiểm tra lại ' +
                    'wiring của ItemLeaderboardTop.groupReward.parentDetailRewardGroup trong Editor.',
            );
            return;
        }

        const worldPos = itemLeaderboardGroupReward.node.worldPosition.clone();
        this.detailRewardGroup.node.setParent(reparentTarget);
        this.detailRewardGroup.node.setWorldPosition(worldPos);
        this.detailRewardGroup.node.setSiblingIndex(-1);

        if (this.lastRewardDetailSource !== itemLeaderboardGroupReward) {
            this.lastRewardDetailSource = itemLeaderboardGroupReward;
            this.detailRewardGroup.node.active = true;
            this.detailRewardGroup.initGroup(itemLeaderboardGroupReward.gameResources);
        } else {
            this.detailRewardGroup.node.active = true;
            this.detailRewardGroup.showGroup();
        }
    };


    /** Toạ độ Y trong ScrollView cho 1 hạng THẬT (1-based, khớp indexRank) — TỰ TRỪ rankOffset nên
     * mọi nơi gọi hàm này luôn truyền hạng THẬT (newRank/oldRank/finalRank...), không cần tự trừ. */
    private yForRank(rank: number): number {
        return -this.sizeItem / 2 - (rank - 1 - this.rankOffset) * this.rowHeight;
    }

    /** Tốc độ bay (px/giây) cho hành trình leo `k` hạng — tăng dần TUYẾN TÍNH theo k (leo ít hạng
     * bay chậm, leo nhiều hạng bay nhanh), từ climbSpeedMin (k=1) tới climbSpeedMax (đạt ở mốc hạng
     * = maxClimbDuration/stepDuration, giữ nguyên ý nghĩa "trần thời gian khi leo ít hạng nhất" của
     * 2 property đó) — rồi giữ NGUYÊN climbSpeedMax nếu leo nhiều hạng hơn mốc này nữa. */
    private computeClimbSpeed(k: number): number {
        const speedMaxAtRank = Math.max(1, this.maxClimbDuration / Math.max(0.01, this.stepDuration));
        const t = Math.min(1, (k - 1) / Math.max(0.01, speedMaxAtRank - 1));
        const speed = this.climbSpeedMin + (this.climbSpeedMax - this.climbSpeedMin) * t;
        return Math.min(this.climbSpeedMax, Math.max(this.climbSpeedMin, speed));
    }

    /**
     * Dựng danh sách quanh oldRank/newRank và chạy animation leo hạng — gọi 1 lần khi popup mở.
     * @param oldScore điểm Weekly TRƯỚC lần thắng vừa rồi.
     * @param newScore điểm Weekly SAU lần thắng vừa rồi.
     * @param onDone gọi khi animation xong (kể cả trường hợp không leo hạng, xong ngay).
     */
    play(oldScore: number, newScore: number, onDone: () => void): void {
        this.pendingAvatarLoads = [];
        this.avatarReadyCallbacks = [];
        for (const node of this.hideUntilLoaded) if (node) node.active = false;
        if (!this.scrollView || !this.contentGroup || !this.itemPrefab || !LegacyLeaderboardManager.instance) {
            // Không có gì để tải cả — hiện lại NGAY, không có gì sẽ gọi onAvatarsReady() để tự hiện
            // lại nữa (pendingAvatarLoads mãi mãi rỗng, nhưng không ai đăng ký callback ở nhánh này).
            for (const node of this.hideUntilLoaded) if (node) node.active = true;
            onDone();
            return;
        }

        const rawBotScores = LegacyLeaderboardManager.instance.getFakeBotWeeklyScores();
        // Ghép (điểm, danh tính) THEO INDEX trước khi sort — danh tính đọc từ cache dùng chung
        // getFakeBotWeeklyIdentities() (giống hệt cách LeaderboardGroupWeek dựng bảng Weekly thật),
        // KHÔNG tự random tên/avatar riêng ở đây nữa. Trước đây preview tự tạo danh tính random
        // MỚI mỗi lần play() chạy, khiến tab Leaderboard thật và popup Preview hiện 2 bộ tên/avatar
        // khác nhau cho cùng 1 bộ điểm bot.
        const rawBotIdentities = LegacyLeaderboardManager.instance.getFakeBotWeeklyIdentities();

        // Bot 0 điểm (vùng thấp/luôn-0 lúc reset, xem LeaderboardManager.buildBaselineWeeklyBotScores())
        // KHÔNG được xếp hạng — CÙNG quy tắc với tab Leaderboard thật (LeaderboardGroupWeek.showGroup()),
        // chỉ bot đã tự ghi được điểm (rollWeeklyOnlineGrowth/rollWeeklyOfflineGrowth) mới xuất hiện ở
        // đây. Lọc TRƯỚC khi tính oldRank/newRank/totalRanks — nếu không, bot 0 điểm vẫn chiếm 1 "ô
        // hạng" ảo trong animation dù không hề hiện trên bảng xếp hạng thật.
        const botScores: number[] = [];
        const botIdentities: { userName: string; avatarURL: string }[] = [];
        for (let i = 0; i < rawBotScores.length; i++) {
            if (rawBotScores[i] <= 0) continue;
            botScores.push(rawBotScores[i]);
            botIdentities.push(rawBotIdentities[i]);
        }

        const sortedBots = botScores
            .map((score, i) => ({ score, identity: botIdentities[i] }))
            .sort((a, b) => b.score - a.score);
        this.totalRanks = sortedBots.length + 1;


        const oldRank = 1 + botScores.filter((s) => s >= oldScore).length;
        const newRank = 1 + botScores.filter((s) => s >= newScore).length;

        this.buildFinalRankList(sortedBots, newRank, newScore);

        // topSlots CHỈ coi là "đã gán" khi đủ ĐÚNG 3 phần tử — thiếu/sai số lượng thì lùi hẳn về
        // hành vi CŨ (rankOffset=0, hạng 1-3 vẫn nằm trong ScrollView như trước khi có tính năng
        // này), an toàn cho tới khi Editor được wire đúng 3 node top1/top2/top3.
        this.rankOffset = this.topSlots.length === 3 ? 3 : 0;
        // "Tôi" ĐÃ ở sẵn trong top3 từ TRƯỚC lần thắng này (oldRank<=3) — hoàn toàn KHÔNG có hàng
        // ScrollView nào cho "tôi" cả (kể cả khi còn leo lên hạng tốt hơn NGAY trong top3), toàn bộ
        // animation (nếu có leo) chạy bằng runTopSlotInternalClimb() — xem buildAnimationWindow().
        const startsInTopSlots = this.rankOffset > 0 && oldRank <= 3;
        // Leo hạng từ NGOÀI top3 (oldRank>3) VÀO ĐÚNG top3 (newRank<=3) — chạy nhánh animation
        // riêng (bay xuyên khỏi ScrollView rồi "đáp" vào bục TOP3), xem runTopSlotEntrance().
        const enteringTop3 = this.rankOffset > 0 && !startsInTopSlots && newRank <= 3;
        // Cả 2 trường hợp trên đều cần bục TOP3 hiện TRẠNG THÁI CŨ lúc vừa mở popup (tránh lộ kết
        // quả trước khi animation chạy tới) — CHỈ khi không leo hạng gì cả (hoặc leo hạng ngoài
        // top3, không đụng gì tới top3) mới hiện thẳng trạng thái CUỐI CÙNG luôn.
        const showOldTopSlots = enteringTop3 || startsInTopSlots;

        this.buildTopSlots(sortedBots, showOldTopSlots, startsInTopSlots, oldRank, oldScore);

        this.climbing = true;
        this.buildAnimationWindow(oldRank, newRank, startsInTopSlots);

        // pendingAvatarLoads đã dựng XONG HẲN (đồng bộ, buildTopSlots + buildAnimationWindow ở trên
        // đều push THẲNG trong cùng lệnh gọi play() này, không qua await/scheduleOnce nào) — snapshot
        // NGAY tại đây rồi gắn .then() DUY NHẤT gọi thẳng resolveAvatarsReady(), không còn lớp
        // .then() nào khác lồng thêm ở nơi khác (xem onAvatarsReady()/avatarReadyCallbacks).
        const avatarLoadsSnapshot = this.pendingAvatarLoads;
        Promise.all(avatarLoadsSnapshot).then(() => this.resolveAvatarsReady(avatarLoadsSnapshot));
        this.onAvatarsReady(() => {
            if (!this.isValid) return;
            for (const node of this.hideUntilLoaded) if (node) node.active = true;
        });

        // Dòng "tôi" trong ScrollView (KHÔNG áp dụng khi startsInTopSlots — xem ghi chú ở trên)
        // ban đầu hiện số tim CŨ và THỨ HẠNG CŨ (oldRank) — trước đây dòng vừa dựng lên đã hiện sẵn
        // newRank dù còn đứng ở vị trí cũ (info gán cho hàng vốn đã là dữ liệu hạng mới). Số tim
        // mới được cộng dần lúc tim bay vào (runHeartGainPhase), thứ hạng tăng dần đúng lúc đi qua
        // từng bậc lúc leo hạng (scheduleRankLabelTicks).
        const playerRow = startsInTopSlots ? null : this.rows.get(newRank) ?? null;
        playerRow?.item?.setScoreValue(oldScore);
        playerRow?.item?.setDisplayedRank(oldRank);

        this.scheduleOnce(() => this.scrollToRank(oldRank, 0), 0);

        const climbedRanks = oldRank - newRank;

        // Đích của hiệu ứng tim bay: hàng ScrollView bình thường, HOẶC label tim ở ĐÚNG bục top3
        // "tôi" đang đứng (startsInTopSlots) — trước đây LUÔN nhắm vào hàng ScrollView, kể cả khi
        // "tôi" đã ở sẵn top3 (hàng đó bị dựng ở vị trí NGOÀI khung nhìn do rankOffset, tim bay bay
        // tới chỗ vô hình — đúng bug đã báo "tim đang bay đến vị trí sai").
        const topSlotForHeart = startsInTopSlots ? this.topSlots[oldRank - 1] ?? null : null;
        const scoreTargetNode = topSlotForHeart ? topSlotForHeart.txtScore?.node ?? null : playerRow?.item?.getScoreTargetNode() ?? null;
        const setScore = (score: number): void => {
            if (topSlotForHeart) {
                if (topSlotForHeart.txtScore) topSlotForHeart.txtScore.string = `x${score}`;
            } else {
                playerRow?.item?.setScoreValue(score);
            }
        };

        // "Node track bay vào ô điểm chỉ được kích hoạt khi các node ở hideUntilLoaded hiện lên"
        // (xác nhận từ user) — trước đây CHỈ đợi initialHoldSeconds (hẹn giờ cố định), độc lập hoàn
        // toàn với việc avatar/frame đã tải xong hay chưa. Nếu tải chậm hơn initialHoldSeconds, icon
        // ray sẽ bắt đầu bay NGAY TRONG LÚC nội dung vẫn còn ẩn (hideUntilLoaded chưa active=true) —
        // trông như bay vào khoảng trống/đè lên nội dung chưa kịp hiện. Giờ đợi CẢ 2 điều kiện: hết
        // initialHoldSeconds VÀ onAvatarsReady() đã báo xong — cái nào xong SAU mới là mốc bắt đầu
        // thật sự.
        let holdElapsed = false;
        let avatarsReady = false;
        const tryStartHeartGainPhase = (): void => {
            if (!holdElapsed || !avatarsReady || !this.isValid) return;
            this.runHeartGainPhase(scoreTargetNode, setScore, oldScore, newScore, () => {
                if (climbedRanks <= 0) {
                    this.finishClimb(onDone);
                    return;
                }
                if (startsInTopSlots) {
                    this.runTopSlotInternalClimb(oldRank, newRank, onDone);
                    return;
                }
                // Tim vừa bay vào xong — bật particle di chuyển NGAY (không đợi "nhấc lên" chạy
                // xong nữa), chạy song song với toàn bộ runLiftPhase() (nhấc lên rồi mới di chuyển).
                if (playerRow) this.startMoveParticle(playerRow);
                this.runLiftPhase(oldRank, newRank, climbedRanks, enteringTop3, onDone);
            });
        };
        this.scheduleOnce(() => { holdElapsed = true; tryStartHeartGainPhase(); }, this.initialHoldSeconds);
        this.onAvatarsReady(() => { avatarsReady = true; tryStartHeartGainPhase(); });
    }

    /** Bục TOP3 tĩnh: hiện TRẠNG THÁI CŨ (trước lần thắng này) lúc vừa mở popup NẾU `showOld=true`
     * (đang leo VÀO top3 từ ngoài, HOẶC đã ở sẵn top3 từ trước) — tránh lộ kết quả trước khi
     * animation leo hạng chạy tới, đúng tinh thần "chỉ đúng khi tôi bay qua/tới nơi" áp dụng luôn
     * cho khu vực TOP3. `showOld=false` (không leo hạng gì, hoặc leo hạng ngoài top3) hiện THẲNG
     * trạng thái CUỐI CÙNG luôn, không có animation bục riêng.
     * @param startsInTopSlots true nếu "tôi" ĐÃ ở sẵn top3 — slot đúng `oldRank` phải hiện DATA
     * CỦA CHÍNH "tôi" (điểm CŨ oldScore), không phải 1 bot nào khác. */
    private buildTopSlots(
        sortedBots: readonly { score: number; identity?: { userName: string; avatarURL: string } }[],
        showOld: boolean,
        startsInTopSlots: boolean,
        oldRank: number,
        oldScore: number,
    ): void {
        if (this.topSlots.length !== 3) return;

        if (!showOld) {
            for (let i = 0; i < 3; i++) {
                const info = this.arrItemRankInfos[i];
                if (info) this.pendingAvatarLoads.push(this.topSlots[i].init(info, 0));
            }
            return;
        }

        let botIndex = 0;
        for (let i = 0; i < 3; i++) {
            const rank = i + 1;
            if (startsInTopSlots && rank === oldRank) {
                const info = this.buildPlayerInfo(oldScore);
                info.indexRank = rank;
                this.pendingAvatarLoads.push(this.topSlots[i].init(info, 0));
                continue;
            }
            const bot = sortedBots[botIndex++];
            if (!bot) continue;
            const info = this.buildBotInfo(bot.score, bot.identity);
            info.indexRank = rank;
            this.pendingAvatarLoads.push(this.topSlots[i].init(info, 0));
        }
    }

    /**
     * Số tim vừa kiếm được (newScore - oldScore) bay từ điểm xuất phát vào ĐÚNG `targetNode` (label
     * tim của dòng "tôi" — ScrollView hoặc bục TOP3 tuỳ trường hợp, xem play()), mỗi icon tới nơi
     * thì `setScore()` được gọi để tăng dần số tim — xong hết mới gọi onDone (rồi mới leo hạng).
     * Không có hiệu ứng (chưa gán heartFlyEffect / không có tim mới / không có targetNode) thì cập
     * nhật số ngay, gọi onDone ngay.
     */
    private runHeartGainPhase(
        targetNode: Node | null,
        setScore: (score: number) => void,
        oldScore: number,
        newScore: number,
        onDone: () => void,
    ): void {
        const gained = newScore - oldScore;

        if (!this.heartFlyEffect || !targetNode || gained <= 0) {
            setScore(newScore);
            onDone();
            return;
        }

        const count = Math.min(gained, MAX_FLY_HEARTS);
        this.heartFlyEffect.play(
            this.resolveHeartFlyStart(),
            targetNode.getWorldPosition(),
            count,
            gained,
            (index) => {
                setScore(oldScore + Math.round((gained * (index + 1)) / count));
                this.bumpScoreLabel(targetNode);
            },
            () => {
                setScore(newScore);
                this.scheduleOnce(onDone, this.postHeartGainSeconds);
            },
        );
    }

    /** Điểm xuất phát tim bay: heartFlyStartNode nếu có gán, không thì giữa mép DƯỚI khung danh sách. */
    private resolveHeartFlyStart(): Vec3 {
        if (this.heartFlyStartNode) {
            // Widget của node này trong Editor đang canh theo CHA TRỰC TIẾP (panel, chỉ 100×100 —
            // KHÔNG phải màn hình thật), nên "ghim cạnh trái" trước giờ ra sai vị trí bất kể có gọi
            // updateAlignment() hay không (Widget tính đúng theo target, nhưng target sai). Ép
            // target về this.node.parent (node gốc của CHÍNH popup này, luôn phủ full màn hình —
            // xem heartFlyStartLeftMargin) rồi mới updateAlignment(), thay vì phụ thuộc cấu hình
            // Editor — an toàn kể cả nếu Editor sau này đổi lại cấu trúc node.
            const widget = this.heartFlyStartNode.getComponent(Widget);
            if (widget && this.node.parent) {
                const originalTarget = widget.target;
                const originalLeft = widget.left;
                const originalIsAbsLeft = widget.isAbsoluteLeft;
                const wasEnabled = widget.enabled;

                widget.target = this.node.parent;
                widget.isAlignLeft = true;
                widget.isAbsoluteLeft = true;
                widget.left = this.heartFlyStartLeftMargin;
                widget.enabled = true;
                widget.updateAlignment();

                widget.enabled = wasEnabled;
                widget.target = originalTarget;
                widget.left = originalLeft;
                widget.isAbsoluteLeft = originalIsAbsLeft;
            }
            return this.heartFlyStartNode.getWorldPosition();
        }

        const world = this.scrollView.node.getWorldPosition();
        const height = this.scrollView.node.getComponent(UITransform)?.height ?? 0;
        return new Vec3(world.x, world.y - height / 2, world.z);
    }

    private bumpScoreLabel(node: Node): void {
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        tween(node)
            .to(0.08, { scale: new Vec3(SCORE_BUMP_SCALE, SCORE_BUMP_SCALE, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private runLiftPhase(oldRank: number, newRank: number, k: number, enteringTop3: boolean, onDone: () => void): void {
        const playerRow = this.rows.get(newRank);
        if (!playerRow) {
            this.climbing = false;
            onDone();
            return;
        }
        this.climbOldRank = oldRank;
        // Tốc độ px/giây tỉ lệ theo k (xem computeClimbSpeed) — dùng CHUNG cho cả pha ScrollView
        // cuộn lẫn pha hàng "tôi" tự bay bù quãng còn lại, để 2 pha nối nhau mượt, không còn cảm
        // giác cuộn chậm rồi đột nhiên bay nhanh khi ScrollView hết cuộn được.
        const speed = this.computeClimbSpeed(k);

        // Label/sprite thứ hạng đã hiện oldRank từ lúc dựng hàng (xem play()) — lên lịch tăng dần
        // đúng lúc hàng "tôi" đi ngang qua từng hạng trong lúc di chuyển (đồng bộ bằng speed). Cùng
        // lúc, mỗi bot bị vượt CHỈ được lộ đúng thứ hạng/vị trí CUỐI CÙNG đúng lúc "tôi" bay ngang
        // qua nó — KHÔNG hiện sẵn từ đầu như trước (xem revealOvertakenBotAt()).
        this.scheduleRankLabelTicks(playerRow, oldRank, newRank, k, speed, enteringTop3);

        Tween.stopAllByTarget(playerRow.node);
        tween(playerRow.node)
            .to(this.liftDuration, { scale: new Vec3(this.liftScale, this.liftScale, 1) }, { easing: 'backOut' })
            .call(() => this.runScrollPinnedPhase(playerRow, oldRank, newRank, speed, enteringTop3, onDone))
            .start();
    }

    /** Đổi label/sprite thứ hạng của hàng "tôi" + lộ dần từng bot bị vượt, ĐÚNG lúc nó đi qua từng
     * hạng — mốc thời gian tính y hệt quãng đường vật lý (i hạng × rowHeight ÷ speed), nên luôn
     * khớp với vị trí hàng đang hiện trên màn dù đang ở pha cuộn hay pha tự bay (2 pha dùng chung
     * speed). rank<=3 tự đổi dần sang sprite huy chương top3/2/1 qua setDisplayedRank() — CHỈ áp
     * dụng khi KHÔNG leo vào bục TOP3 tĩnh (enteringTop3=false, hàng "tôi" vẫn còn tồn tại trong
     * ScrollView ở những hạng đó); leo vào TOP3 tĩnh thì hàng "tôi" đã biến mất trước khi chạm hạng
     * 3 (xem runFlyPastViewport()) nên dừng tick sớm hơn (chỉ tick tới hạng rankOffset+1). */
    private scheduleRankLabelTicks(
        playerRow: RankRow,
        oldRank: number,
        newRank: number,
        k: number,
        speed: number,
        enteringTop3: boolean,
    ): void {
        const lastTickRank = enteringTop3 ? this.rankOffset + 1 : newRank;
        for (let i = 1; i <= k; i++) {
            const rank = oldRank - i;
            const delay = this.liftDuration + climbTimeForDistance(i * this.rowHeight, speed, this.climbAccelSeconds);
            // Bot mà "tôi" vừa vượt qua ở tick này ĐANG đứng ở hạng CŨ `rank` (trước khi có lần
            // thắng này) — hạng CUỐI CÙNG của nó (sau khi nhường 1 ô cho "tôi") là rank+1, xem
            // spawnRow()/buildAnimationWindow() (startRank=finalRank-1).
            const overtakenFinalRank = rank + 1;
            this.scheduleOnce(() => {
                if (rank >= lastTickRank) playerRow.item?.setDisplayedRank(rank, true);
                this.revealOvertakenBotAt(overtakenFinalRank);
            }, delay);
        }
    }

    /** Bot có hạng CUỐI CÙNG `finalRank` (vừa bị "tôi" vượt qua, đang đứng ở vị trí CŨ finalRank-1)
     * — dịch xuống đúng 1 ô (vị trí cuối cùng) + đổi nhãn/huy chương thứ hạng ĐÚNG lúc "tôi" bay
     * ngang qua nó, thay vì hiện sẵn thứ hạng cuối cùng ngay từ lúc dựng hàng (spawnRow) như trước
     * — tránh lộ trước kết quả cho các hạng "tôi" CHƯA bay tới. Không làm gì nếu hạng đó không có
     * hàng nào (ngoài cửa sổ animationWindow, hoặc đã là bục TOP3 tĩnh). */
    private revealOvertakenBotAt(finalRank: number): void {
        const row = this.rows.get(finalRank);
        if (!row) return;

        Tween.stopAllByTarget(row.node);
        tween(row.node)
            .to(this.separateSeconds, { position: new Vec3(0, this.yForRank(finalRank), 0) }, { easing: 'quadOut' })
            .start();
        row.item?.setDisplayedRank(finalRank, true);
    }

    /** ScrollView cuộn tới khi vị trí đúng nằm ngay dưới hàng "tôi" (hoặc kịch biên, không cuộn
     * thêm được nữa) — quãng cuộn được bao nhiêu thì cuộn hết bấy nhiêu, PHẦN CÒN LẠI (nếu có,
     * ví dụ hạng đích ở top không canh đáy, hoặc cuộn đã kịch biên) do hàng "tôi" tự bay nốt ở
     * runFlyToOvershoot()/runFlyPastViewport() — CÙNG TỐC ĐỘ speed (px/giây) nên không đổi nhịp
     * giữa 2 pha. Leo VÀO bục TOP3 tĩnh (enteringTop3): ScrollView chỉ cuộn tới hạng rankOffset+1
     * (hạng 4) rồi DỪNG HẲN — không còn cuộn thêm vào "vùng" hạng 1-3 nữa (khu đó giờ là bục tĩnh
     * ngoài ScrollView), phần còn lại hàng "tôi" tự bay xuyên qua khung nhìn rồi biến mất. */
    private runScrollPinnedPhase(
        playerRow: RankRow,
        oldRank: number,
        newRank: number,
        speed: number,
        enteringTop3: boolean,
        onDone: () => void,
    ): void {
        const scrollTargetRank = enteringTop3 ? this.rankOffset + 1 : newRank;
        const startOffsetY = this.computeScrollTargetY(oldRank);
        const targetOffsetY = this.computeScrollTargetY(scrollTargetRank);
        const scrollDistance = Math.abs(targetOffsetY - startOffsetY);

        // traveledDistance: quãng đã đi tính từ lúc bắt đầu leo — pha tự bay tiếp nối đúng điểm này trên CÙNG
        // đường cong tăng tốc (climbMotion) nên vận tốc liên tục, không tăng tốc lại từ 0.
        const proceed = (traveledDistance: number): void => {
            if (enteringTop3) this.runFlyPastViewport(playerRow, newRank, speed, onDone, traveledDistance);
            else this.runFlyToOvershoot(playerRow, newRank, speed, onDone, traveledDistance);
        };

        if (scrollDistance < 0.5) {
            proceed(0);
            return;
        }

        const scrollDuration = climbSegmentDuration(0, scrollDistance, speed, this.climbAccelSeconds);
        this.pinnedPlayerNode = playerRow.node;
        this.pinnedAnchorSlotConstant = this.anchorSlotConstant();

        // Tự lái ScrollView mỗi frame (tween + easing "tăng tốc đều rồi chạy đều") thay cho
        // scrollToOffset(thời gian, attenuated=false) — API đó chỉ có chạy đều hoặc giảm tốc, không có gia tốc.
        // scrollToOffset(..., 0) là cuộn tức thì; gọi onScrolling() tay để hàng "tôi" ghim đúng vị trí neo.
        const applyOffset = (fraction: number): void => {
            this.scrollView?.scrollToOffset(new Vec3(0, startOffsetY + (targetOffsetY - startOffsetY) * fraction, 0), 0);
            this.onScrolling();
        };
        const progress = { value: 0 };
        this.climbScrollProxy = progress;
        tween(progress)
            .to(scrollDuration, { value: 1 }, {
                easing: climbSegmentEasing(0, scrollDistance, speed, this.climbAccelSeconds),
                onUpdate: () => applyOffset(progress.value),
            })
            .call(() => {
                applyOffset(1);
                this.climbScrollProxy = null;
                this.pinnedPlayerNode = null;
                proceed(scrollDistance);
            })
            .start();
    }

    /** Sau khi ScrollView đã cuộn hết mức (hoặc không cần cuộn) — hàng "tôi" bay THẲNG tới đúng vị
     * trí cuối cùng (yForRank(newRank)) bằng `speed` (px/giây) đã dùng ở pha cuộn, KHÔNG còn "bay
     * vượt" thêm nửa hạng phía trên rồi mới đập xuống như trước — tới đúng vị trí thì dừng thêm
     * separateSeconds (đợi các bot bị vượt ổn định — xem revealOvertakenBotAt) rồi chạy thẳng hiệu
     * ứng "đập xuống" (playThud, giờ chỉ còn thuần scale, không di chuyển gì thêm). */
    private runFlyToOvershoot(playerRow: RankRow, newRank: number, speed: number, onDone: () => void, traveledDistance = 0): void {
        const finalY = this.yForRank(newRank);
        const remaining = Math.abs(finalY - playerRow.node.position.y);

        Tween.stopAllByTarget(playerRow.node);
        const arrive = (): void => {
            // Tới đúng vị trí — di chuyển thật đã XONG, tắt particle TRƯỚC khi chạy "đập xuống".
            this.stopMoveParticle();
            this.scheduleOnce(() => this.playThud(newRank, onDone), this.separateSeconds);
        };

        if (remaining < 0.5) {
            arrive();
            return;
        }

        const endDistance = traveledDistance + remaining;
        tween(playerRow.node)
            .to(
                climbSegmentDuration(traveledDistance, endDistance, speed, this.climbAccelSeconds),
                { position: new Vec3(0, finalY, 0) },
                { easing: climbSegmentEasing(traveledDistance, endDistance, speed, this.climbAccelSeconds) },
            )
            .call(arrive)
            .start();
    }

    /** Leo VÀO bục TOP3 tĩnh: hàng "tôi" (vẫn đang là 1 hàng bình thường trong ScrollView) tiếp
     * tục bay CÙNG tốc độ `speed` cho tới khi ra khỏi hẳn mép TRÊN khung nhìn (Mask tự che khuất
     * dần) + thêm flyPastViewportExtraRows hàng cho chắc, rồi biến mất (gỡ khỏi ScrollView) — sau
     * đó mới "đáp" xuống bục TOP3 tĩnh tương ứng (runTopSlotEntrance()). */
    private runFlyPastViewport(playerRow: RankRow, newRank: number, speed: number, onDone: () => void, traveledDistance = 0): void {
        // Số hàng phía TRÊN vị trí neo (anchorRowsAboveTarget) mới là khoảng cách thật cần bay
        // thêm để ra khỏi mép TRÊN khung nhìn — KHÔNG còn là visibleRows đầy đủ như hồi neo đáy
        // (playerAnchorRatio=1); neo giữa (0.5, mặc định mới) thì chỉ còn NỬA khung nhìn phía trên.
        const topVisibleRank = (this.rankOffset + 1) - this.anchorRowsAboveTarget + 1 - this.flyPastViewportExtraRows;
        const exitY = this.yForRank(topVisibleRank);
        const remaining = Math.abs(exitY - playerRow.node.position.y);

        Tween.stopAllByTarget(playerRow.node);
        const vanish = (): void => {
            // Hàng sắp bị gỡ khỏi ScrollView + đưa vào pool tái dùng cho hạng khác — PHẢI gỡ
            // particle ra khỏi hàng TRƯỚC khi pool, không để pool tái dùng node còn dính particle.
            this.stopMoveParticle();
            this.rows.delete(newRank);
            playerRow.node.active = false;
            this.pool.push(playerRow.node);
            this.runTopSlotEntrance(newRank, onDone);
        };

        if (remaining < 0.5) {
            vanish();
            return;
        }
        const endDistance = traveledDistance + remaining;
        tween(playerRow.node)
            .to(
                climbSegmentDuration(traveledDistance, endDistance, speed, this.climbAccelSeconds),
                { position: new Vec3(0, exitY, 0) },
                { easing: climbSegmentEasing(traveledDistance, endDistance, speed, this.climbAccelSeconds) },
            )
            .call(vanish)
            .start();
    }

    /** Node avatar + node frame của 1 bục (2 node RIÊNG, KHÔNG chung 1 group) — mọi hiệu ứng đổi
     * hạng (fade/scale/rơi xuống/lún) CHỈ áp dụng đúng 2 node này, các node còn lại của bục (tên,
     * điểm, hộp quà, số/huy chương hạng) GIỮ NGUYÊN không hiệu ứng gì, chỉ đổi giá trị NGAY khi
     * applySlotDataInstant() chạy. */
    private avatarFrameNodes(slot: ItemLeaderboardTop): Node[] {
        const nodes: Node[] = [];
        if (slot.iconAvatar) nodes.push(slot.iconAvatar.node);
        if (slot.iconFrame) nodes.push(slot.iconFrame.node);
        return nodes;
    }

    private ensureOpacity(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    }

    /** Đưa `node` (avatar hoặc frame) lên TRÊN CÙNG mọi node khác của `slot` — cha TẠM THỜI thẳng
     * vào `slot.node` (giữ NGUYÊN vị trí/scale nhìn thấy được qua world position/scale, không đổi
     * hình), rồi setSiblingIndex(-1) (con CUỐI CÙNG = vẽ SAU CÙNG = nổi trên hết). Cần TẠM cha lại
     * (không chỉ setSiblingIndex ngay tại cha hiện tại) vì avatar/frame có thể đang nằm SÂU trong 1
     * node con riêng (khác nhánh với tên/điểm/hộp quà/số hạng) — chỉ đổi thứ tự trong nhánh riêng
     * đó KHÔNG đủ để nổi lên trên các nhánh khác của bục. Trả về thông tin để restoreSlotParent()
     * phục hồi lại đúng cha/vị trí/thứ tự CŨ sau khi animation xong. */
    private raiseAboveSlot(slot: ItemLeaderboardTop, node: Node): { parent: Node; siblingIndex: number; localPos: Vec3 } | null {
        const originalParent = node.parent;
        if (!originalParent) return null;

        const originalIndex = originalParent.children.indexOf(node);
        const originalLocalPos = node.position.clone();

        if (originalParent !== slot.node) {
            const worldPos = node.getWorldPosition();
            const worldScale = node.getWorldScale();
            node.setParent(slot.node);
            node.setWorldPosition(worldPos);
            node.setWorldScale(worldScale);
        }
        node.setSiblingIndex(-1);

        return { parent: originalParent, siblingIndex: originalIndex, localPos: originalLocalPos };
    }

    /** Phục hồi đúng cha/vị trí/thứ tự CŨ đã lưu ở raiseAboveSlot() — gọi SAU KHI animation "nổi
     * lên trên" đã xong hẳn, tránh để hạng tầng cây node bị xáo trộn vĩnh viễn. */
    private restoreSlotParent(node: Node, saved: { parent: Node; siblingIndex: number; localPos: Vec3 } | null): void {
        if (!saved || !node.isValid || !saved.parent.isValid) return;

        if (node.parent !== saved.parent) {
            node.setParent(saved.parent);
            node.setPosition(saved.localPos);
        }
        node.setSiblingIndex(saved.siblingIndex);
    }

    /** Đổi data của bục sang `info` NGAY LẬP TỨC (tên/điểm/hộp quà/số hạng/avatar+frame đều cập
     * nhật đúng giá trị mới) nhưng CHẶN hẳn hiệu ứng fade+scale mặc định của init()/showItem() áp
     * lên CẢ CỤM (groupAll) — snap thẳng về trạng thái cuối (opacity đầy, scale đúng). Avatar+frame
     * được hoạt hoạ RIÊNG, TÁCH BIỆT khỏi hàm này (xem fadeOutAvatarFrame/fadeInAvatarFrame/
     * runTopSlotEntrance), đúng yêu cầu "hiệu ứng chỉ áp dụng avatar và frame, các node còn lại
     * giữ nguyên". */
    private applySlotDataInstant(slot: ItemLeaderboardTop, info: ItemRankInfo): void {
        // showGoldBorderNow=false: viền vàng (nếu info.isMyRank) KHÔNG được hiện NGAY ở đây — chỉ
        // hiện SAU KHI hiệu ứng avatar+frame chạy xong (gọi showGoldBorder() riêng ở nơi gọi hàm
        // này — runTopSlotEntrance/flyAvatarFrameBetweenSlots). Luôn hideGoldBorder() trước để xoá
        // trạng thái CŨ (bục này có thể vừa đổi từ "tôi" sang bot khác, hoặc ngược lại).
        slot.init(info, 0, false);
        slot.hideGoldBorder();

        const group = slot.groupAll;
        const opacity = slot.groupAllOpacity;
        if (group) {
            Tween.stopAllByTarget(group);
            // Cùng công thức targetScale của ItemLeaderboardBase.showItem() (1.026 cho dòng "tôi",
            // 1 cho người khác) — snap thẳng, không tween.
            const targetScale = info.isMyRank ? 1.026 : 1;
            group.setScale(new Vec3(targetScale, targetScale, 1));
        }
        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 255;
        }
    }

    /** loadAvatar() (ItemLeaderboardBase, chạy NGAY trong applySlotDataInstant() ở trên) load ảnh
     * BẤT ĐỒNG BỘ — poll tới khi CẢ 2 ảnh avatar+frame đã có spriteFrame rồi mới gọi `onReady` —
     * dùng để hoãn hiệu ứng hiện lên (fade/rơi xuống/bay tới) tới khi ảnh THẬT SỰ sẵn sàng, tránh
     * hiện cụm TRẮNG rồi ảnh mới "hiện ra" đột ngột giữa/sau khi hiệu ứng đã chạy xong (bug đã báo,
     * kèm ảnh). Quá topSlotAvatarLoadTimeoutSeconds mà VẪN chưa xong (ảnh lỗi/mạng chậm) — THỬ LẠI
     * ĐÚNG 1 LẦN (applySlotDataInstant() gọi lại init(), tự kích loadAvatar() lần nữa, phòng lỗi
     * tạm thời) trước khi cứ chạy tiếp dù ảnh có thể vẫn chưa có (bug đã báo lần 2 — tên hiện, ảnh
     * không hiện, KHÔNG tự hồi phục — khác hẳn lần đầu chỉ là tải chậm). */
    private waitForAvatarFrameLoaded(slot: ItemLeaderboardTop, info: ItemRankInfo, onReady: () => void, retried = false): void {
        let elapsed = 0;
        const check = (): void => {
            const avatarReady = !slot.iconAvatar || !!slot.iconAvatar.spriteFrame;
            const frameReady = !slot.iconFrame || !!slot.iconFrame.spriteFrame;
            if (avatarReady && frameReady) {
                onReady();
                return;
            }
            if (elapsed >= this.topSlotAvatarLoadTimeoutSeconds) {
                // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân avatar/frame không hiện cho 1 số bot.
                if (!retried) {
                    this.applySlotDataInstant(slot, info);
                    this.waitForAvatarFrameLoaded(slot, info, onReady, true);
                    return;
                }
                onReady();
                return;
            }
            elapsed += this.topSlotAvatarLoadPollSeconds;
            this.scheduleOnce(check, this.topSlotAvatarLoadPollSeconds);
        };
        check();
    }

    /** Fade+scale-out CHỈ avatar+frame (opacity 255→0, scale 1→0.8) — các node khác của bục không
     * đụng tới. */
    private fadeOutAvatarFrame(slot: ItemLeaderboardTop, onDone: () => void): void {
        const nodes = this.avatarFrameNodes(slot);
        if (nodes.length === 0) {
            onDone();
            return;
        }

        let remaining = nodes.length;
        for (const node of nodes) {
            const opacity = this.ensureOpacity(node);
            Tween.stopAllByTarget(node);
            Tween.stopAllByTarget(opacity);
            tween(node).to(this.topSlotSwapFadeSeconds, { scale: new Vec3(0.8, 0.8, 1) }).start();
            tween(opacity)
                .to(this.topSlotSwapFadeSeconds, { opacity: 0 })
                .call(() => {
                    remaining--;
                    if (remaining <= 0) onDone();
                })
                .start();
        }
    }

    /** Fade+scale-in CHỈ avatar+frame (opacity 0→255, scale 0.8→gốc) — dùng SAU applySlotDataInstant()
     * (đã đổi sprite avatar/frame sang đúng người mới). */
    private fadeInAvatarFrame(slot: ItemLeaderboardTop): void {
        for (const node of this.avatarFrameNodes(slot)) {
            const opacity = this.ensureOpacity(node);
            Tween.stopAllByTarget(node);
            Tween.stopAllByTarget(opacity);
            // Bục này có thể là bục CŨ "tôi" vừa rời đi — flyAvatarFrameBetweenSlots() tắt hẳn
            // node.active để nhường chỗ cho "bóng ma" bay lúc leo hạng nội bộ Top3, KHÔNG tự bật
            // lại — nếu không bật ở đây, bot MỚI đổi vào bục này (qua fadeSwapTopSlot) đổi đúng
            // data/opacity nhưng node vẫn ẩn, không thấy gì (bug đã báo, kèm ảnh).
            node.active = true;
            node.setScale(new Vec3(0.8, 0.8, 1));
            opacity.opacity = 0;
            tween(node).to(this.topSlotSwapFadeSeconds, { scale: new Vec3(1, 1, 1) }).start();
            tween(opacity).to(this.topSlotSwapFadeSeconds, { opacity: 255 }).start();
        }
    }

    /**
     * Avatar+frame "tôi" ĐÁP vào bục TOP3 tĩnh đúng vị trí `newRank` (1-3) — CHỈ 2 node avatar+
     * frame hoạt hoạ, các node khác của bục (tên/điểm/hộp quà/số hạng) đổi giá trị NGAY không hiệu
     * ứng (xem applySlotDataInstant()):
     * 1. Avatar+frame BOT đang đứng đó fade+scale-out (opacity 255→0, scale 1→0.8).
     * 2. Đổi data cả bục sang "tôi" (applySlotDataInstant — avatar/frame nạp ảnh mới NGAY, các
     *    node khác snap đúng giá trị).
     * 3. Avatar+frame "tôi" đặt vị trí THẤP HƠN đúng vị trí topSlotRiseDistance px, scale to hơn
     *    gốc (topSlotEnterScale), trượt thẳng lên đúng vị trí gốc (topSlotRiseSeconds).
     * 4. "Đập xuống": LÚN xuống topSlotSquashScale rồi hồi lại scale gốc (topSlotSquashSeconds/
     *    topSlotSettleSeconds) — cùng ý tưởng dogPopSquashScale của CellView (mèo đặt xuống).
     * 5. Dừng thêm topSlotOthersSwapDelaySeconds rồi mới đổi 2 bục CÒN LẠI sang đúng bot (chỉ
     *    những bục THẬT SỰ đổi bot — bục ở hạng TỐT HƠN newRank không hề bị ảnh hưởng, xem
     *    swapRemainingTopSlots()).
     */
    private runTopSlotEntrance(newRank: number, onDone: () => void): void {
        const slot = this.topSlots[newRank - 1];
        const info = this.arrItemRankInfos[newRank - 1];
        if (!slot || !info) {
            this.finishClimb(onDone);
            return;
        }

        const enterPlayer = (): void => {
            this.applySlotDataInstant(slot, info);

            // Đợi ảnh avatar+frame "tôi" tải XONG (bất đồng bộ) rồi mới bắt đầu hiệu ứng rơi từ
            // dưới lên — tránh hiện cụm TRẮNG rồi ảnh mới "hiện ra" đột ngột giữa/sau khi hiệu ứng
            // đã chạy xong (bug đã báo, kèm ảnh).
            this.waitForAvatarFrameLoaded(slot, info, () => {
                const nodes = this.avatarFrameNodes(slot);
                const totalRiseSeconds = this.topSlotRiseSeconds + this.topSlotSquashSeconds + this.topSlotSettleSeconds;
                for (const node of nodes) {
                    // Nổi lên TRÊN CÙNG mọi node khác của bục (tên/điểm/hộp quà/số hạng...) suốt
                    // lúc trượt lên — không thì dễ bị node khác đè lên (bug đã báo, kèm ảnh).
                    const savedParent = this.raiseAboveSlot(slot, node);
                    const rest = node.position.clone();
                    Tween.stopAllByTarget(node);
                    node.active = true;
                    node.setPosition(rest.x, rest.y - this.topSlotRiseDistance, rest.z);
                    node.setScale(new Vec3(this.topSlotEnterScale, this.topSlotEnterScale, 1));
                    const opacity = this.ensureOpacity(node);
                    Tween.stopAllByTarget(opacity);
                    opacity.opacity = 255;

                    tween(node)
                        .to(this.topSlotRiseSeconds, { position: rest }, { easing: 'quadOut' })
                        .call(() => {
                            tween(node)
                                .to(this.topSlotSquashSeconds, { scale: new Vec3(this.topSlotSquashScale, this.topSlotSquashScale, 1) }, { easing: 'quadIn' })
                                .to(this.topSlotSettleSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
                                .call(() => this.restoreSlotParent(node, savedParent))
                                .start();
                        })
                        .start();
                }

                // Cả 2 node (avatar+frame) trượt lên CÙNG topSlotRiseSeconds, bắt đầu ĐỒNG THỜI —
                // bắn particle ĐÚNG 1 LẦN (không lặp lại theo từng node) ngay lúc trượt lên xong,
                // đúng thời điểm bắt đầu "đập xuống" (squash).
                this.scheduleOnce(() => {
                    this.playLandParticle(
                        this.topSlotLandParticle,
                        this.topSlotLandParticleWorldPos(slot.node.worldPosition),
                        this.topSlotLandParticleDuration,
                    );
                }, this.topSlotRiseSeconds);

                // avatar+frame chạy 2 tween GIỐNG HỆT nhau (cùng thời lượng) — đợi đúng tổng thời
                // gian đó thay vì đợi callback riêng từng node.
                this.scheduleOnce(() => {
                    // Hiệu ứng avatar+frame đã chạy XONG — ĐÚNG lúc này mới hiện viền vàng (mờ dần).
                    if (info.isMyRank) slot.showGoldBorder(true);
                    this.scheduleOnce(() => {
                        this.swapRemainingTopSlots(newRank, () => this.finishClimb(onDone));
                    }, this.topSlotOthersSwapDelaySeconds);
                }, totalRiseSeconds);
            });
        };

        this.fadeOutAvatarFrame(slot, enterPlayer);
    }

    /**
     * "Tôi" ĐÃ ở sẵn top3, leo lên hạng TỐT HƠN NGAY TRONG NỘI BỘ top3 (vd hạng 3 → hạng 1) —
     * KHÔNG có hàng ScrollView nào liên quan, chỉ có 2 bục TOP3 tĩnh (bục CŨ `oldRank` và bục ĐÍCH
     * `newRank`):
     * 1. Dừng topSlotClimbStartDelaySeconds trước khi bắt đầu cả chuỗi.
     * 2. "Nhấc lên" (scale topSlotClimbLiftScale) avatar+frame "tôi" tại bục CŨ.
     * 3. Avatar+frame "tôi" BAY sang đúng vị trí bục ĐÍCH (topSlotClimbFlySeconds) — dùng "bóng ma"
     *    (ghost, clone sprite hiện tại) bay xuyên toạ độ world giữa 2 bục khác nhau, ĐỒNG THỜI avatar
     *    +frame của bot đang chiếm bục ĐÍCH fade+scale-out (dọn chỗ, xem fadeOutAvatarFrame()).
     * 4. Ghost tới nơi thì biến mất, avatar+frame THẬT tại bục đích hiện lên (đã nạp data "tôi") rồi
     *    "đập xuống" (lún topSlotSquashScale) đúng như hiệu ứng ở runTopSlotEntrance().
     * 5. Dừng thêm topSlotOthersSwapDelaySeconds rồi đổi 2 bục còn lại sang đúng bot (swapRemainingTopSlots
     *    — dùng CHUNG với runTopSlotEntrance(), tự tính đúng bục nào thật sự cần đổi theo arrItemRankInfos).
     */
    private runTopSlotInternalClimb(oldRank: number, newRank: number, onDone: () => void): void {
        const fromSlot = this.topSlots[oldRank - 1];
        const toSlot = this.topSlots[newRank - 1];
        const info = this.arrItemRankInfos[newRank - 1];
        if (!fromSlot || !toSlot || !info) {
            this.finishClimb(onDone);
            return;
        }

        this.scheduleOnce(() => {
            // Đồng thời: bot đang chiếm bục ĐÍCH mờ dần đi (dọn chỗ) trong lúc "tôi" bay tới —
            // KHÔNG chờ hàm này xong mới bay (thật sự "đồng thời" như yêu cầu).
            this.fadeOutAvatarFrame(toSlot, () => {});

            this.flyAvatarFrameBetweenSlots(fromSlot, toSlot, info, () => {
                this.scheduleOnce(() => {
                    this.swapRemainingTopSlots(newRank, () => this.finishClimb(onDone));
                }, this.topSlotOthersSwapDelaySeconds);
            });
        }, this.topSlotClimbStartDelaySeconds);
    }

    /** Avatar+frame "tôi" bay từ bục `fromSlot` sang ĐÚNG vị trí avatar+frame của bục `toSlot` —
     * dùng "bóng ma" (ghost node clone sprite hiện tại, cha vào layer TRUNG LẬP để bay xuyên toạ
     * độ world giữa 2 hệ cục bộ khác nhau, giống kỹ thuật GameplayScreen.flyHeart()). Node THẬT ở
     * bục CŨ bị ẩn ngay khi ghost xuất hiện; node THẬT ở bục ĐÍCH chỉ hiện lại SAU KHI ghost tới
     * nơi (đã nạp `info` mới qua applySlotDataInstant), kèm hiệu ứng "đập xuống" (lún) quen thuộc. */
    private flyAvatarFrameBetweenSlots(
        fromSlot: ItemLeaderboardTop,
        toSlot: ItemLeaderboardTop,
        info: ItemRankInfo,
        onArrive: () => void,
    ): void {
        const fromNodes = this.avatarFrameNodes(fromSlot);
        const toNodes = this.avatarFrameNodes(toSlot);
        if (fromNodes.length === 0 || fromNodes.length !== toNodes.length) {
            this.applySlotDataInstant(toSlot, info);
            // Không có avatar/frame nào để hoạt hoạ (fallback) — không có "hiệu ứng chạy xong" để
            // đợi, hiện viền NGAY (snap, không opacity) thay vì để trống mãi mãi.
            if (info.isMyRank) toSlot.showGoldBorder(false);
            onArrive();
            return;
        }

        // Cha "bóng ma" vào TỔ TIÊN CHUNG của cả 2 bục (thường là node TOP3 chứa cả top1/top2/top3)
        // + đẩy lên trên cùng — đảm bảo bay NỔI TRÊN mọi nội dung của CẢ 2 bục suốt hành trình,
        // không chỉ trong phạm vi 1 nhánh con hẹp (bug đã báo, kèm ảnh — cụm avatar bị node khác
        // của bục đè lên lúc di chuyển).
        const flyLayer = toSlot.node.parent ?? toSlot.node;

        let remaining = fromNodes.length;
        for (let i = 0; i < fromNodes.length; i++) {
            const fromNode = fromNodes[i];
            const toNode = toNodes[i];

            const fromTransform = fromNode.getComponent(UITransform);
            const fromSprite = fromNode.getComponent(Sprite);

            const ghost = new Node('TopSlotClimbGhost');
            ghost.layer = fromNode.layer;
            ghost.setParent(flyLayer);
            ghost.setSiblingIndex(-1);
            const ghostTransform = ghost.addComponent(UITransform);
            const ghostSprite = ghost.addComponent(Sprite);
            if (fromTransform) ghostTransform.setContentSize(fromTransform.contentSize);
            if (fromSprite) {
                ghostSprite.spriteFrame = fromSprite.spriteFrame;
                ghostSprite.type = fromSprite.type;
                ghostSprite.sizeMode = fromSprite.sizeMode;
            }
            ghost.setWorldPosition(fromNode.getWorldPosition());
            ghost.setWorldScale(fromNode.getWorldScale());

            fromNode.active = false;

            const targetWorldPos = toNode.getWorldPosition();

            tween(ghost)
                .to(this.topSlotClimbLiftSeconds, { scale: new Vec3(this.topSlotClimbLiftScale, this.topSlotClimbLiftScale, 1) }, { easing: 'backOut' })
                .to(this.topSlotClimbFlySeconds, { worldPosition: targetWorldPos }, { easing: 'quadInOut' })
                .call(() => {
                    ghost.destroy();
                    remaining--;
                    if (remaining > 0) return;

                    this.applySlotDataInstant(toSlot, info);
                    // Đợi ảnh avatar+frame "tôi" tải XONG rồi mới "đập xuống" — cùng lý do
                    // waitForAvatarFrameLoaded() ở runTopSlotEntrance().
                    this.waitForAvatarFrameLoaded(toSlot, info, () => {
                        // "Đập xuống" (squash) bắt đầu NGAY ở đây — bắn particle ĐÚNG 1 LẦN (không
                        // lặp lại theo từng node avatar/frame) đúng lúc này.
                        this.playLandParticle(
                            this.topSlotLandParticle,
                            this.topSlotLandParticleWorldPos(toSlot.node.worldPosition),
                            this.topSlotLandParticleDuration,
                        );
                        for (const node of this.avatarFrameNodes(toSlot)) {
                            // Cùng lý do raiseAboveSlot() ở runTopSlotEntrance() — nổi trên cùng
                            // trong lúc "đập xuống" rồi mới phục hồi cha/thứ tự cũ.
                            const savedParent = this.raiseAboveSlot(toSlot, node);
                            Tween.stopAllByTarget(node);
                            node.active = true;
                            const opacity = this.ensureOpacity(node);
                            Tween.stopAllByTarget(opacity);
                            opacity.opacity = 255;
                            node.setScale(new Vec3(this.topSlotClimbLiftScale, this.topSlotClimbLiftScale, 1));
                            tween(node)
                                .to(this.topSlotSquashSeconds, { scale: new Vec3(this.topSlotSquashScale, this.topSlotSquashScale, 1) }, { easing: 'quadIn' })
                                .to(this.topSlotSettleSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
                                .call(() => this.restoreSlotParent(node, savedParent))
                                .start();
                        }
                        // Cả 2 tween squash+settle GIỐNG HỆT nhau (cùng thời lượng, cùng lý do
                        // totalRiseSeconds của runTopSlotEntrance) — đợi đúng tổng đó rồi mới hiện
                        // viền vàng (mờ dần), tức ĐÚNG lúc hiệu ứng avatar+frame chạy xong.
                        if (info.isMyRank) {
                            this.scheduleOnce(() => toSlot.showGoldBorder(true), this.topSlotSquashSeconds + this.topSlotSettleSeconds);
                        }
                        onArrive();
                    });
                })
                .start();
        }
    }

    /** 2 bục CÒN LẠI (khác `enteredRank`) đổi sang đúng bot cuối cùng — CHỈ những bục ở hạng THẤP
     * HƠN (số to hơn) enteredRank thật sự bị đẩy lùi 1 bậc; bục TỐT HƠN enteredRank không hề đổi
     * bot (xem giải thích trong ghi chú play()/runTopSlotEntrance ở trên). */
    private swapRemainingTopSlots(enteredRank: number, onDone: () => void): void {
        const targets = [1, 2, 3].filter((rank) => rank > enteredRank);
        if (targets.length === 0) {
            onDone();
            return;
        }

        let remaining = targets.length;
        const done = (): void => {
            remaining--;
            if (remaining <= 0) onDone();
        };

        for (const rank of targets) {
            const slot = this.topSlots[rank - 1];
            const info = this.arrItemRankInfos[rank - 1];
            if (!slot || !info) {
                done();
                continue;
            }
            this.fadeSwapTopSlot(slot, info, done);
        }
    }

    /** Fade-out avatar+frame CŨ rồi đổi data + fade-in avatar+frame MỚI — các node khác của bục
     * (tên/điểm/hộp quà/số hạng) chỉ đổi giá trị NGAY (applySlotDataInstant), không hiệu ứng gì. */
    private fadeSwapTopSlot(slot: ItemLeaderboardTop, info: ItemRankInfo, onDone: () => void): void {
        this.fadeOutAvatarFrame(slot, () => {
            this.applySlotDataInstant(slot, info);
            this.waitForAvatarFrameLoaded(slot, info, () => this.fadeInAvatarFrame(slot));
            onDone();
        });
    }

    private finishClimb(onDone: () => void): void {
        this.climbing = false;
        this.lastCenterRank = -1;
        this.onScrolling();
        onDone();
    }

    /** Các hàng bị vượt TÁCH ra (dịch xuống 1 ô) ngay khi hàng "tôi" bắt đầu đập xuống — dừng 1
     * nhịp (separateSeconds) trên vị trí bay vượt trước khi thật sự đập xuống đúng vị trí. Vị trí
     * của các bot bị vượt đã được cập nhật DẦN qua revealOvertakenBotAt() lúc "tôi" bay qua từng
     * hạng — ở đây chỉ còn lại chính hàng "tôi" cần đập xuống. */
    private buildFinalRankList(
        sortedBots: readonly { score: number; identity?: { userName: string; avatarURL: string } }[],
        newRank: number,
        newScore: number,
    ): void {
        const entries: ItemRankInfo[] = sortedBots.map((bot) => this.buildBotInfo(bot.score, bot.identity));
        entries.splice(newRank - 1, 0, this.buildPlayerInfo(newScore));
        for (let i = 0; i < entries.length; i++) entries[i].indexRank = i + 1;
        this.arrItemRankInfos = entries;
    }


    /** @param enteringTop3 xem play() — khi true, hạng 1..rankOffset KHÔNG được dựng thành hàng
     * ScrollView (kể cả các bot bị "tôi" vượt qua nằm trong khoảng đó) — khu đó giờ do bục TOP3
     * tĩnh đảm nhiệm hoàn toàn (xem buildTopSlots()/swapRemainingTopSlots()), CHỈ TRỪ chính hàng
     * "tôi" (vẫn cần dựng bên trong ScrollView để có thể "bay" từ dưới lên trước khi biến mất). */
    /** @param startsInTopSlots true nếu "tôi" ĐÃ ở sẵn top3 (xem play()) — hàng "tôi" hoàn toàn
     * KHÔNG được dựng trong ScrollView (kể cả khi còn leo hạng NỘI BỘ trong top3), chỉ sống ở bục
     * TOP3 tĩnh (runTopSlotInternalClimb()). Hạng 1..rankOffset (bot bị vượt nằm trong khoảng đó)
     * cũng KHÔNG BAO GIỜ được dựng thành hàng ScrollView khi rankOffset>0 — khu đó luôn do bục
     * TOP3 tĩnh đảm nhiệm (buildTopSlots()/swapRemainingTopSlots()). */
    private buildAnimationWindow(oldRank: number, newRank: number, startsInTopSlots: boolean): void {
        this.contentGroup.removeAllChildren();
        this.rows.clear();
        this.pool = [];
        this.lastCenterRank = -1;

        this.contentGroup.getComponent(UITransform)?.setContentSize(
            this.contentGroup.getComponent(UITransform)?.contentSize.width ?? 720,
            Math.max(0, this.totalRanks - this.rankOffset) * this.rowHeight + this.sizeItem,
        );

        // pad phía TRÊN newRank thường bị "cắt bớt" khi newRank gần đầu danh sách (rankOffset+1) —
        // dồn phần pad THỪA đó xuống phía DƯỚI oldRank, tránh cửa sổ dựng ra quá hẹp (bug đã báo,
        // kèm ảnh: hiệu ứng tim đang chạy mà ScrollView chỉ hiện tới đúng hạng 5) khi "tôi" đã ở
        // gần đầu bảng (oldRank/newRank nhỏ) — không leo hạng bao xa nên oldRank+pad tự nhiên nhỏ.
        const pad = Math.max(this.visibleRows, Math.floor(this.countShowItem / 2));
        const topFloor = this.rankOffset + 1;
        const lo = Math.max(topFloor, newRank - pad);
        const unusedTopPad = Math.max(0, pad - (newRank - lo));
        const hi = Math.min(this.totalRanks, oldRank + pad + unusedTopPad);

        for (let finalRank = lo; finalRank <= hi; finalRank++) {
            if (!startsInTopSlots && finalRank === newRank) {

                const info = this.arrItemRankInfos[finalRank - 1];
                this.spawnRow(finalRank, info, oldRank);
                continue;
            }
            if (this.rankOffset > 0 && finalRank <= this.rankOffset) continue;
            if (finalRank > newRank && finalRank <= oldRank) {

                const info = this.arrItemRankInfos[finalRank - 1];
                this.spawnRow(finalRank, info, finalRank - 1);
                continue;
            }

            this.ensureRowBuilt(finalRank);
        }

        // ĐÃ TÌM RA BUG: khi leo THẲNG vào top3 (enteringTop3, newRank <= rankOffset) mà oldRank đủ
        // xa (newRank - pad > topFloor không đúng — thật ra NGƯỢC LẠI: lo = max(topFloor, newRank -
        // pad) LUÔN >= topFloor = rankOffset+1 > newRank khi newRank <= rankOffset), vòng lặp TRÊN
        // KHÔNG BAO GIỜ chạy tới finalRank === newRank (lo đã lớn hơn newRank ngay từ đầu) — hàng
        // "tôi" (spawnRow ở nhánh finalRank===newRank) không được dựng, this.rows không có key
        // newRank, runLiftPhase() thấy rows.get(newRank) là undefined nên bỏ cuộc NGAY (không lỗi,
        // không hiệu ứng gì — đúng bug đã báo "leo lên top3 lần đầu, dòng của tôi biến mất, không
        // hiệu ứng"). Dựng bù ở đây, đảm bảo hàng "tôi" LUÔN tồn tại bất kể lo/hi tính ra sao.
        if (!startsInTopSlots && !this.rows.has(newRank)) {
            const info = this.arrItemRankInfos[newRank - 1];
            if (info) this.spawnRow(newRank, info, oldRank);
        }

        const playerNode = this.rows.get(newRank)?.node;
        if (playerNode) {
            playerNode.setSiblingIndex(this.contentGroup.children.length - 1);
        }
    }


    private ensureRowBuilt(rank: number): void {
        if (this.rows.has(rank) || rank <= this.rankOffset || rank > this.totalRanks) return;
        const info = this.arrItemRankInfos[rank - 1];
        if (!info) return;
        this.spawnRow(rank, info, rank);
    }

    /** @param finalRank hạng CUỐI CÙNG (dùng làm key trong rows map, không đổi trong suốt vòng đời).
     * @param startRank hạng ban đầu để đặt vị trí Y lúc dựng (khác finalRank khi hàng này còn phải
     * animate tới finalRank). Hạng hiển thị (label/huy chương) LUÔN khởi tạo theo startRank chứ
     * KHÔNG theo info.indexRank (hạng CUỐI CÙNG) khi 2 giá trị này khác nhau — tránh lộ trước kết
     * quả cho tới khi hàng "tôi" thật sự bay ngang qua (xem revealOvertakenBotAt()). */
    private spawnRow(finalRank: number, info: ItemRankInfo, startRank: number): void {
        const node = this.acquireNode();
        Tween.stopAllByTarget(node);
        node.setPosition(new Vec3(0, this.yForRank(startRank), 0));
        node.setScale(new Vec3(1, 1, 1));
        node.active = true;
        const item = node.getComponent(ItemLeaderboardEntryBase);
        const loaded = item?.init(info, 0);
        if (loaded) this.pendingAvatarLoads.push(loaded);
        if (startRank !== finalRank) item?.setDisplayedRank(startRank, false);
        this.rows.set(finalRank, { rank: finalRank, node, item });
    }

    private acquireNode(): Node {
        const pooled = this.pool.pop();
        if (pooled) return pooled;
        const node = instantiate(this.itemPrefab);
        node.setParent(this.contentGroup);
        return node;
    }

    private evictRow(rank: number): void {
        const row = this.rows.get(rank);
        if (!row) return;
        row.node.active = false;
        this.pool.push(row.node);
        this.rows.delete(rank);
    }

    private buildPlayerInfo(score: number): ItemRankInfo {
        const info = new ItemRankInfo();
        info.isMyRank = true;
        info.userScore = score;
        info.userName = ProfileManager.instance?.getName() ?? '';
        return info;
    }

    private buildBotInfo(score: number, identity?: { userName: string; avatarURL: string }): ItemRankInfo {
        const info = new ItemRankInfo();
        info.isMyRank = false;
        info.userScore = score;
        info.avatarType = AVATAR_TYPE.TYPE_LOCAL;
        // Ưu tiên danh tính cache dùng chung (khớp tab Leaderboard thật) — chỉ random riêng nếu
        // vì lý do gì đó thiếu (phòng hờ, không nên xảy ra vì identity luôn cùng độ dài với score).
        info.userName = identity?.userName ?? `${ProfileManager.instance?.getRandomName() ?? ''}`;
        info.avatarURL = identity?.avatarURL ?? ProfileManager.instance?.getRandomAvatarURL() ?? '';

        // LOG TẠM ĐỂ DEBUG — xoá sau khi tìm ra nguyên nhân avatar/frame không hiện cho 1 số bot.

        return info;
    }


    private playThud(rank: number, onDone: () => void): void {
        const row = this.rows.get(rank);
        if (!row) {
            this.finishClimb(onDone);
            return;
        }
        this.playLandParticleGroup(this.scrollRowLandParticleGroup, row.node.worldPosition);
        this.playLandBorder(this.scrollRowLandBorder, row.node.worldPosition);
        Tween.stopAllByTarget(row.node);
        tween(row.node)
            .to(0.1, { scale: new Vec3(this.thudSquashScale, this.thudSquashScale, 1) }, { easing: 'quadOut' })
            .to(0.5, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .call(() => this.finishClimb(onDone))
            .start();
    }


    /** Số hàng nằm PHÍA TRÊN vị trí neo — 0 = neo sát mép trên (không hàng nào phía trên), tới
     * visibleRows = neo sát mép dưới (hành vi CŨ, toàn bộ visibleRows hàng nằm phía trên). Dùng
     * CHUNG cho cả computeScrollTargetY() lẫn anchorSlotConstant() để 2 công thức luôn khớp nhau
     * (bất biến "hàng tôi luôn hiện đúng tại vị trí neo trên màn hình" — xem giải thích trong
     * lịch sử sửa đổi của computeScrollTargetY). */
    private get anchorRowsAboveTarget(): number {
        return this.visibleRows * this.playerAnchorRatio;
    }

    private computeScrollTargetY(rank: number): number {
        const scrollTotal = Math.max(0, this.totalRanks - this.rankOffset);
        const contentHeight = scrollTotal * this.rowHeight + this.sizeItem;
        const viewHeight = this.rowHeight * this.visibleRows;
        const maxScrollY = Math.max(0, contentHeight - viewHeight);
        const scrollRank = rank - this.rankOffset;
        const targetY = rank <= this.topRanksSkipBottomAnchor ? 0 : (scrollRank - this.anchorRowsAboveTarget) * this.rowHeight;
        return Math.min(maxScrollY, Math.max(0, targetY));
    }


    private anchorSlotConstant(): number {
        return -this.sizeItem / 2 + this.rowHeight * (1 - this.anchorRowsAboveTarget);
    }

    /** @param duration 0 = tức thì. */
    private scrollToRank(rank: number, duration: number): void {
        if (!this.scrollView || this.totalRanks <= 0) return;
        this.scrollView.scrollToOffset(new Vec3(0, this.computeScrollTargetY(rank), 0), duration);
    }


    private onScrolling(): void {
        if (this.pinnedPlayerNode && this.scrollView) {
            const offsetY = this.scrollView.getScrollOffset().y;
            this.pinnedPlayerNode.setPosition(0, this.pinnedAnchorSlotConstant - offsetY, 0);
        }

        if (this.climbing || !this.scrollView || this.totalRanks <= 0) return;

        const offsetY = this.scrollView.getScrollOffset().y;
        const viewHeight = this.rowHeight * this.visibleRows;
        // offsetY tính trong không gian ScrollView đã CO NGẮN (không còn 3 hạng top3) — cộng lại
        // rankOffset để ra đúng hạng THẬT (khớp key trong this.rows/arrItemRankInfos).
        let centerRank = Math.round((offsetY + viewHeight / 2 - this.sizeItem / 2) / this.rowHeight) + 1 + this.rankOffset;
        centerRank = Math.min(this.totalRanks, Math.max(this.rankOffset + 1, centerRank));
        if (this.lastCenterRank === centerRank) return;
        this.lastCenterRank = centerRank;

        const half = Math.max(1, Math.floor(this.countShowItem / 2));
        const lo = Math.max(this.rankOffset + 1, centerRank - half);
        const hi = Math.min(this.totalRanks, centerRank + half);

        for (const rank of Array.from(this.rows.keys())) {
            if (rank < lo || rank > hi) this.evictRow(rank);
        }
        for (let rank = lo; rank <= hi; rank++) {
            this.ensureRowBuilt(rank);
        }
    }
}