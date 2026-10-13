// @ts-nocheck
import { _decorator, Component, director, Enum, Node } from 'cc';
import { LeaderboardDataInfo } from '../common/LeaderboardDataInfo';
import { ItemRankInfo } from '../common/ItemRankInfo';
import { Constants } from '../framework/constants';
import { LeaderboardDataSave } from './LeaderboardDataSave';
import { configuration } from '../framework/configuration';
import { LeaderboardReward } from './LeaderboardReward';
import { ReadDataJsonCommon } from '../data/ReadDataJsonCommon';
import { PGSPlayInstantManager } from '../common/PGSPlayInstantManager';
import { ProfileManager } from '../profile/ProfileManager';
import { localConfig } from '../localConfig';
import { ResourceRewards } from '../datainfo/GameResource';
import {
  getBotTierByIndex,
  rollWeeklyPointsOnMatchEnd,
  rollWeeklyPointsOffline,
  getGlobalBotTierByIndex,
  rollGlobalPointsOnMatchEnd,
  rollGlobalPointsOffline,
  getOfflineTickMinutes,
  OFFLINE_TICK_MINUTES_NORMAL,
  WeeklyMatchOutcome,
} from '../config/WeeklyLeagueConfig';
const { ccclass, property } = _decorator;

/** 49 bot + 1 người chơi thật = đúng 50 người trên cả bảng Weekly lẫn Global. */
const FAKE_BOT_COUNT = 49;
/** Khoảng điểm KHỞI ĐIỂM ngẫu nhiên của MỖI bot Weekly khi giải đấu reset (xem
 * buildBaselineWeeklyBotScores()) — rescale lại theo thang điểm MỚI của ConnectTracks (số ô đường
 * ray/màn, thường 10..50 quanh level mở Leaderboard — GameConfig.leaderboardUnlockLevel=10), thay
 * cho thang tim cũ (0..3/màn). Tương đương "khoảng 1 màn" của người chơi mới — đủ thấp để chơi
 * CHỈ 3-4 màn đầu (xác nhận từ user) là leo lên được Top 1-3, vẫn đủ cao để không trống rỗng. */
const FAKE_BOT_WEEKLY_START_MIN = 15;
const FAKE_BOT_WEEKLY_START_MAX = 30;
/** Hạng (1-based, theo INDEX bot — index+1, xem getBotTierByIndex) bắt đầu "vùng thấp" — từ hạng
 * này trở đi, bot KHÔNG còn chắc chắn có điểm khởi điểm bình thường nữa. */
const FAKE_BOT_LOW_TIER_START_RANK = 30;
/** Hạng (1-based) bắt đầu "vùng luôn 0 điểm" khi reset — bot ở hạng này trở đi CHẮC CHẮN bắt đầu
 * với 0 điểm, không hiện trên bảng xếp hạng cho tới khi tự "chơi thêm" ghi được điểm đầu tiên
 * (xem rollWeeklyOnlineGrowth/rollWeeklyOfflineGrowth — vẫn roll bình thường dù đang 0 điểm). */
const FAKE_BOT_ALWAYS_ZERO_START_RANK = 41;
/** Trong "vùng thấp" (FAKE_BOT_LOW_TIER_START_RANK..ALWAYS_ZERO_START_RANK-1), tỉ lệ 1 bot rơi vào
 * điểm khởi điểm THẤP (0..10, cùng tỉ lệ ~1/3 mức bình thường 15..30 như thang điểm cũ) thay vì mức
 * bình thường. */
const FAKE_BOT_LOW_TIER_CHANCE = 0.5;
const FAKE_BOT_LOW_SCORE_MIN = 0;
const FAKE_BOT_LOW_SCORE_MAX = 10;
/** Điểm KHỞI ĐIỂM của bot #0 cho Global — cao hơn hẳn Weekly vì Global là TỔNG SỐ MÀN đã chơi
 * dồn suốt cả game (617 màn campaign), không reset theo tuần như Weekly. */
const FAKE_BOT_GLOBAL_TOP_SCORE = 150;
/** Chặn trên số chu kỳ offline được bù trong 1 lần tính (1 ngày ở chu kỳ 10 phút/lần — CÙNG độ
 * dài với TOURNAMENT_DURATION_MS bên dưới, không có lý do bù offline VƯỢT QUÁ thời lượng 1 giải
 * đấu) — tránh vòng lặp quá lớn nếu người chơi bỏ app rất lâu (hàng tháng/năm). */
const MAX_OFFLINE_TICKS = 1 * 24 * 6;
/** Hạng Weekly (1-based, số CÀNG LỚN càng tệ) THẤP NHẤT người chơi được phép tụt xuống khi bù
 * OFFLINE — chọn ngẫu nhiên mỗi lần bù trong khoảng [MIN,MAX], rồi bot NGỪNG tăng điểm hẳn ngay
 * khi hạng người chơi vừa chạm mốc đó, dù còn bù bao nhiêu chu kỳ offline nữa cũng vậy — đảm bảo
 * quay lại chơi vẫn còn leo hạng được, không bị bot bỏ xa vô hạn nếu offline quá lâu. CHỈ áp dụng
 * offline (rollWeeklyOfflineGrowth) — lúc đang chơi thật (rollWeeklyOnlineGrowth, thắng/thua) thì
 * KHÔNG giới hạn, vì đó là kết quả tự nhiên do chính người chơi tạo ra. */
const OFFLINE_RANK_FLOOR_MIN = 7;
const OFFLINE_RANK_FLOOR_MAX = 10;
/** Thời lượng 1 giải đấu Weekly — 1 NGÀY (trước đây 7 ngày), đếm RIÊNG cho từng người chơi kể từ
 * tournamentStartMs (KHÔNG theo lịch chung thứ 2 hàng tuần cho mọi người). Tên hằng số/biến giữ
 * nguyên "Weekly"/"tournamentStartMs" dù chu kỳ đã đổi — đổi tên sẽ động chạm rất nhiều chỗ khác
 * (LeaderboardDataSave, LeaderboardGroupWeek, UI...) không cần thiết cho riêng thay đổi độ dài này. */
const TOURNAMENT_DURATION_MS = 1 * 24 * 60 * 60 * 1000;

@ccclass('LeaderboardManager')
export class LeaderboardManager extends Component {
  public static instance: LeaderboardManager = null;
  protected onLoad(): void {
    director.addPersistRootNode(this.node);
    LeaderboardManager.instance = this;
    // Bản gốc chỉ gọi initLeaderboardManager() từ LoadSceneManager.ts (hệ thống loading không
    // copy sang Dogdoku) — tự gọi ngay để leaderboardDataSave không bao giờ null.
    this.initLeaderboardManager();
  }

  leaderboardRewards: ResourceRewards[] = [];

  leaderboardDataSave:LeaderboardDataSave = null;

  arrTopPlayers: ItemRankInfo[] = [];

  initLeaderboardManager() {
    this.leaderboardRewards = ReadDataJsonCommon.instance.readLeaderboardData();
    this.initCurrWeek();

    this.leaderboardDataSave = new LeaderboardDataSave();
    this.leaderboardDataSave.initLeaderboardDataSave(configuration.instance.getData_Leaderboard());

    // Khôi phục cache bot Weekly (điểm + tên/avatar) từ save — trước đây cache này CHỈ ở bộ nhớ,
    // mất mỗi lần tắt app, khiến bảng xếp hạng "reset" (bot random lại từ đầu) dù giải đấu chưa
    // thật sự kết thúc. Rỗng (save cũ trước khi có field này, hoặc chưa từng chơi) thì để null —
    // getFakeBotWeeklyScores()/getFakeBotWeeklyIdentities() tự dựng mới lúc cần như trước.
    if (this.leaderboardDataSave.fakeBotScores.length > 0) {
      this.fakeBotScores = this.leaderboardDataSave.fakeBotScores;
      this.fakeBotWeek = this.currWeek;
    }
    if (this.leaderboardDataSave.fakeBotIdentities.length > 0) {
      this.fakeBotWeeklyIdentities = this.leaderboardDataSave.fakeBotIdentities;
    }

    // CHÚ Ý: KHÔNG tự đặt tournamentStartMs = Date.now() ở đây nữa — người chơi hoàn toàn mới
    // (tournamentStartMs == 0) coi như giải đấu CHƯA ĐƯỢC KÍCH HOẠT, bảng Weekly đứng yên hoàn
    // toàn (không đếm giờ, không tăng điểm bot) cho tới khi activateTournament() được gọi — SAU
    // KHI họ đã thắng ít nhất 1 màn campaign VÀ quay lại màn Home (xem GameManager.onNavigate/
    // checkTournamentActivation, TournamentActivationPopup).
    this.checkWeekRollover();

    if(this.leaderboardDataSave.lastWeekCheckReward == 0){
      this.leaderboardDataSave.lastWeekCheckReward = this.currWeek;
      this.leaderboardDataSave.claimedReward = 0;
      this.setSaveLeaderboardData();
    }
  }
  

  setSaveLeaderboardData() {
    // Đồng bộ cache bot Weekly (điểm + danh tính) vào leaderboardDataSave TRƯỚC khi lưu — mọi thay
    // đổi bot (thắng/thua/bù offline) đều đi qua hàm này ngay sau đó, nên bot luôn được lưu mới
    // nhất, không còn mất khi tắt app.
    this.leaderboardDataSave.fakeBotScores = this.fakeBotScores ?? [];
    this.leaderboardDataSave.fakeBotIdentities = this.fakeBotWeeklyIdentities ?? [];

    let strLeaderboardData = this.leaderboardDataSave.getStrLeaderboardDataSave();
    configuration.instance.setData_Leaderboard(strLeaderboardData);
  }

  getLeaderboardTutorialCompleted() {
    return this.leaderboardDataSave.tutorialCompleted;
  }

  setLeaderboardTutorialCompleted() {
    this.leaderboardDataSave.tutorialCompleted = 1;
    this.setSaveLeaderboardData();
  }

  setLeaderboardCurrWeekScore(currWeekScore: number) {
    this.leaderboardDataSave.currWeekScore = currWeekScore;
    this.setSaveLeaderboardData();
  }

  getLeaderboardCurrWeekScore() {
    this.checkWeekRollover();
    return this.leaderboardDataSave.currWeekScore;
  }

  /** Giải đấu KHÔNG còn theo lịch chung (thứ 2 hàng tuần cho mọi người) nữa — mỗi người chơi tự
   * đếm 7 ngày RIÊNG kể từ tournamentStartMs của chính họ (đặt lại = Date.now() mỗi khi
   * resolvePendingTournamentResult() chạy, tức lúc bấm Claim/Got it). Gọi ở MỌI điểm vào đọc/ghi
   * dữ liệu Weekly (addCurrWeekScore, getLeaderboardCurrWeekScore, getFakeBotWeeklyScores,
   * getTimeToNextWeek) để tự phát hiện đúng lúc hết hạn, dù người chơi có tắt app hay không.
   *
   * KHÔNG tự reset điểm/bot ngay ở đây nữa — chỉ CHỐT LẠI kết quả giải đấu vừa kết thúc (hạng cuối
   * cùng) vào pendingResultRank rồi DỪNG, giữ nguyên currWeekScore/bot cũ để UI còn tính đúng hạng
   * hiển thị cho popup Claim/Got it. Việc reset thật sự (tạo giải đấu mới, đặt lại tournamentStartMs)
   * chỉ xảy ra khi resolvePendingTournamentResult() được gọi — SAU KHI người chơi đã bấm nút đó. */
  private checkWeekRollover(): void {
    if (!this.leaderboardDataSave) return;
    this.initCurrWeek();

    // tournamentStartMs == 0 nghĩa là giải đấu CHƯA ĐƯỢC KÍCH HOẠT (người chơi mới hoàn toàn,
    // chưa thắng màn campaign nào post-tutorial) — đứng yên hoàn toàn, không tính hết hạn (nếu
    // không, Date.now() - 0 sẽ ra hàng chục năm, lập tức bị coi là "đã hết hạn" ngay từ đầu — bug
    // thật cần tránh). checkOfflineGrowth() ở cuối hàm cũng tự động không chạy vì return sớm.
    if (!this.leaderboardDataSave.tournamentStartMs) return;

    const elapsedMs = Date.now() - this.leaderboardDataSave.tournamentStartMs;
    if (elapsedMs >= TOURNAMENT_DURATION_MS && this.leaderboardDataSave.pendingResultRank === 0) {
      // CHÚ Ý: KHÔNG được gọi this.getFakeBotWeeklyScores() ở đây — hàm đó tự gọi lại
      // checkWeekRollover() ở dòng đầu tiên, tạo đệ quy vô hạn (Maximum call stack size exceeded)
      // ngay khi phát hiện rollover. Đọc thẳng cache nội bộ (đã có sẵn từ tuần cũ, do bot "chơi
      // thêm" mỗi lần người chơi thắng màn trong tuần đó rồi) — nếu vì lý do gì đó chưa có cache
      // (chưa từng chơi trong tuần), tự build 1 bản KHÔNG qua hàm public để tránh vòng lặp.
      const finalScore = this.leaderboardDataSave.currWeekScore;
      const botScores = this.fakeBotScores ?? this.buildBaselineWeeklyBotScores();
      const finalRank = 1 + botScores.filter((s) => s >= finalScore).length;
      this.leaderboardDataSave.pendingResultRank = finalRank;
      // Tăng bộ đếm "đã từng đạt hạng này" NGAY LÚC hạng cuối cùng được xác định (không phải lúc
      // bấm Collect/Claim) — đúng dù người chơi lỡ đóng popup mà không bấm nhận thưởng, "đã đạt
      // được" là sự thật xảy ra ở đây, không phụ thuộc có claim hay không.
      if (finalRank === 1) this.leaderboardDataSave.timesTop1++;
      else if (finalRank === 2) this.leaderboardDataSave.timesTop2++;
      else if (finalRank === 3) this.leaderboardDataSave.timesTop3++;
      this.setSaveLeaderboardData();
    }

    this.checkOfflineGrowth();
  }

  /** Bù điểm bot theo THỜI GIAN THỰC đã trôi qua kể từ lần tính gần nhất (kể cả lúc tắt app) —
   * "% win khi user offline / mỗi 10p không có sự thay đổi điểm" trong bảng thiết kế. Gọi ở CUỐI
   * checkWeekRollover() nên tự động chạy ở mọi điểm vào đọc/ghi Weekly (addCurrWeekScore,
   * getFakeBotWeeklyScores, getLeaderboardCurrWeekScore, getTimeToNextWeek...). */
  private checkOfflineGrowth(ignoreRankFloorForTesting = false): void {
    if (!this.leaderboardDataSave) return;

    const now = Date.now();
    if (!this.leaderboardDataSave.lastOfflineCheckMs) {
      // Lần đầu tiên có field này (save cũ trước khi thêm tính năng, hoặc app mới cài) — chỉ
      // mốc lại mốc thời gian, KHÔNG bù lùi về quá khứ xa vô hạn.
      this.leaderboardDataSave.lastOfflineCheckMs = now;
      this.setSaveLeaderboardData();
      return;
    }

    const elapsedMs = now - this.leaderboardDataSave.lastOfflineCheckMs;
    if (elapsedMs < OFFLINE_TICK_MINUTES_NORMAL * 60000) return;

    // Weekly: chỉ bù khi giải đấu tuần này CHƯA kết thúc (không có pendingResultRank) — tuần đã
    // hết giờ thì bot Weekly đứng yên chờ Claim/Continue, giống hệt lúc addCurrWeekScore().
    if (this.leaderboardDataSave.pendingResultRank === 0) {
      if (this.fakeBotScores == null) this.fakeBotScores = this.buildBaselineWeeklyBotScores();
      this.rollWeeklyOfflineGrowth(this.fakeBotScores, this.leaderboardDataSave.currWeekScore, elapsedMs, ignoreRankFloorForTesting);
    }
    this.rollGlobalOfflineGrowth(this.getFakeBotGlobalScores(), localConfig.instance.currLevelUnlock, elapsedMs);

    this.leaderboardDataSave.lastOfflineCheckMs = now;
    this.setSaveLeaderboardData();
  }

  /** DÙNG ĐỂ TEST — "tua nhanh" thời gian offline để bot Weekly/Global tự tăng điểm NGAY, khỏi
   * phải chờ thật ngoài đời hàng chục phút/giờ mới thấy bot nhích điểm. Lùi mốc lastOfflineCheckMs
   * về quá khứ đúng `hours` giờ rồi gọi checkOfflineGrowth() ngay lập tức — bot tăng điểm y hệt
   * như thể người chơi vừa offline đúng chừng đó lâu (kể cả giới hạn hạng sàn OFFLINE_RANK_FLOOR_
   * MIN/MAX, MAX_OFFLINE_TICKS đều áp dụng y hệt luồng thật). KHÔNG đụng gì tới currWeekScore/tiến
   * trình campaign của người chơi thật. Gán vào Click Events của 1 nút test riêng trong Settings,
   * chỉ nên bật ở build debug. */
  fastForwardOfflineGrowthForTesting(hours: number): void {
    if (!this.leaderboardDataSave || hours <= 0) return;

    const now = Date.now();
    const hoursMs = hours * 3600000;

    const base = this.leaderboardDataSave.lastOfflineCheckMs || now;
    this.leaderboardDataSave.lastOfflineCheckMs = base - hoursMs;

    // Lùi luôn tournamentStartMs đúng bấy nhiêu — node đếm ngược "còn bao lâu tới khi giải đấu hết
    // giờ" (getTimeToNextWeek() = tournamentStartMs + TOURNAMENT_DURATION_MS - now) tính theo mốc
    // này, KHÔNG liên quan gì tới lastOfflineCheckMs ở trên — thiếu dòng này thì bấm nút test chỉ
    // thấy bot tăng điểm mà đồng hồ đếm ngược đứng yên, không khớp với "đã tua nhanh N giờ".
    // == 0 nghĩa là giải đấu CHƯA kích hoạt (người chơi hoàn toàn mới) — không có gì để lùi.
    // LOG TẠM ĐỂ DEBUG — bug "bấm tua nhanh thì đồng hồ TĂNG thay vì GIẢM". Xoá sau khi tìm ra
    // nguyên nhân.
    const beforeRemainingSec = this.leaderboardDataSave.tournamentStartMs
      ? Math.max(0, Math.floor((this.leaderboardDataSave.tournamentStartMs + TOURNAMENT_DURATION_MS - now) / 1000))
      : null;
    console.log('[LeaderboardManager.fastForwardOfflineGrowthForTesting] TRƯỚC', {
      hours, tournamentStartMs: this.leaderboardDataSave.tournamentStartMs, beforeRemainingSec,
    });

    if (this.leaderboardDataSave.tournamentStartMs) {
      this.leaderboardDataSave.tournamentStartMs -= hoursMs;
    }

    const afterRemainingSec = this.leaderboardDataSave.tournamentStartMs
      ? Math.max(0, Math.floor((this.leaderboardDataSave.tournamentStartMs + TOURNAMENT_DURATION_MS - Date.now()) / 1000))
      : null;
    console.log('[LeaderboardManager.fastForwardOfflineGrowthForTesting] SAU', {
      tournamentStartMs: this.leaderboardDataSave.tournamentStartMs, afterRemainingSec,
    });

    // checkOfflineGrowth() tự lưu (setSaveLeaderboardData()) ở cuối — hours>0 luôn đảm bảo
    // elapsedMs vượt ngưỡng OFFLINE_TICK_MINUTES_NORMAL nên không rơi vào nhánh early-return nào,
    // không cần gọi lưu thêm lần nữa ở đây.
    // Test đủ số chu kỳ trong khoảng tua, kể cả khi người chơi đã dưới hạng sàn.
    this.checkOfflineGrowth(true);

    console.log('[LeaderboardManager.fastForwardOfflineGrowthForTesting] SAU checkOfflineGrowth', {
      tournamentStartMs: this.leaderboardDataSave.tournamentStartMs,
      getTimeToNextWeekNgay: this.getTimeToNextWeek(),
    });
  }

  /** Điểm KHỞI ĐIỂM mỗi bot khi giải đấu Weekly RESET (mùa mới) — random ĐỘC LẬP từng bot, chia 3
   * vùng theo hạng (index+1, bot đã sắp theo tier mạnh→yếu dần, xem getBotTierByIndex):
   *   - Hạng 1..29: bình thường, FAKE_BOT_WEEKLY_START_MIN..MAX (3..6), như trước.
   *   - Hạng 30..40: có tỉ lệ FAKE_BOT_LOW_TIER_CHANCE rơi vào mức THẤP (0..2) thay vì bình
   *     thường — bot 0 điểm ở vùng này KHÔNG hiện trên bảng xếp hạng cho tới khi tự ghi được điểm
   *     đầu tiên (xem LeaderboardGroupWeek.showGroup() lọc score<=0).
   *   - Hạng 41..49: LUÔN 0 điểm lúc reset, cùng lý do trên.
   * Random (không còn tuyến tính giảm dần theo thứ hạng) giúp bảng xếp hạng mỗi mùa xáo trộn thứ
   * tự bot trong từng vùng, không lặp lại y hệt trật tự cũ. */
  private buildBaselineWeeklyBotScores(): number[] {
    const scores: number[] = [];
    const normalRange = FAKE_BOT_WEEKLY_START_MAX - FAKE_BOT_WEEKLY_START_MIN;
    const lowRange = FAKE_BOT_LOW_SCORE_MAX - FAKE_BOT_LOW_SCORE_MIN;
    for (let i = 0; i < FAKE_BOT_COUNT; i++) {
      const rank = i + 1;
      if (rank >= FAKE_BOT_ALWAYS_ZERO_START_RANK) {
        scores.push(0);
      } else if (rank >= FAKE_BOT_LOW_TIER_START_RANK && Math.random() < FAKE_BOT_LOW_TIER_CHANCE) {
        scores.push(FAKE_BOT_LOW_SCORE_MIN + Math.floor(Math.random() * (lowRange + 1)));
      } else {
        scores.push(FAKE_BOT_WEEKLY_START_MIN + Math.floor(Math.random() * (normalRange + 1)));
      }
    }
    return scores;
  }

  /** true nếu có 1 kết quả giải đấu tuần trước đang chờ người chơi bấm Claim/Continue (chưa tạo
   * giải đấu mới). UI (GameManager/UIManager) gọi hàm này ở các mốc "mở app"/"qua màn mới" để hiện
   * popup Claim/Continue đúng lúc. */
  hasPendingTournamentResult(): boolean {
    this.checkWeekRollover();
    return this.leaderboardDataSave.pendingResultRank > 0;
  }

  /** Hạng cuối cùng (1-based) của tuần vừa kết thúc — chỉ có ý nghĩa khi hasPendingTournamentResult()
   * đang true. */
  getPendingTournamentRank(): number {
    return this.leaderboardDataSave.pendingResultRank;
  }

  /** Số lần ĐÃ TỪNG đạt ĐÚNG hạng này (1/2/3) tính tới hiện tại — xem timesTop1/2/3 trong
   * LeaderboardDataSave, tăng ở checkWeekRollover(). Hạng khác 1/2/3 luôn trả về 0. */
  getTimesAchievedRank(rank: number): number {
    if (!this.leaderboardDataSave) return 0;
    if (rank === 1) return this.leaderboardDataSave.timesTop1;
    if (rank === 2) return this.leaderboardDataSave.timesTop2;
    if (rank === 3) return this.leaderboardDataSave.timesTop3;
    return 0;
  }

  /** true nếu giải đấu Weekly ĐÃ được kích hoạt (tournamentStartMs khác 0) — người chơi hoàn toàn
   * mới (chưa từng thắng màn campaign nào post-tutorial) sẽ trả về false, bảng Weekly đứng yên
   * hoàn toàn cho tới khi activateTournament() được gọi. */
  hasTournamentActivated(): boolean {
    return !!this.leaderboardDataSave?.tournamentStartMs;
  }

  /** Kích hoạt giải đấu Weekly LẦN ĐẦU cho người chơi hoàn toàn mới — bắt đầu đếm 7 ngày TỪ ĐÂY.
   * Gọi bởi GameManager.checkTournamentActivation() SAU KHI người chơi đã thắng ít nhất 1 màn
   * campaign VÀ quay lại màn Home (TournamentActivationPopup, bấm nút xác nhận). Không làm gì nếu
   * đã kích hoạt rồi (an toàn khi gọi nhiều lần). */
  activateTournament(): void {
    if (!this.leaderboardDataSave || this.hasTournamentActivated()) return;
    this.leaderboardDataSave.tournamentStartMs = Date.now();
    // addCurrWeekScore() cộng điểm/bot VÔ ĐIỀU KIỆN mỗi lần thắng màn campaign, kể cả các màn
    // TRƯỚC khi giải đấu được kích hoạt (chỉ hasTournamentActivated()==false thì KHÔNG hiện popup
    // leo hạng, chứ điểm/bot vẫn âm thầm cộng dồn) — nếu không reset ở đây, người chơi có sẵn
    // "đầu điểm" không công bằng ngay lúc giải đấu vừa mở, thay vì bắt đầu từ 0 đúng nghĩa.
    this.leaderboardDataSave.currWeekScore = 0;
    this.fakeBotScores = null;
    this.fakeBotWeeklyIdentities = null;
    this.setSaveLeaderboardData();
  }

  /** Thực sự "chốt sổ" tuần cũ và tạo giải đấu mới — gọi SAU KHI người chơi đã bấm Claim (đã nhận
   * thưởng xong) hoặc Continue (không lọt top 3). Reset currWeekScore về 0, bot Weekly reset theo
   * currWeek mới (qua getFakeBotWeeklyScores() tự phát hiện fakeBotWeek đổi), xoá pendingResultRank. */
  resolvePendingTournamentResult(): void {
    if (!this.leaderboardDataSave || this.leaderboardDataSave.pendingResultRank === 0) return;
    this.leaderboardDataSave.initNewLeaderboardDataSave(this.currWeek);
    // Giải đấu mới → bot Weekly (điểm + tên/avatar) PHẢI dựng lại từ đầu. Trước đây chỉ trông chờ
    // getFakeBotWeeklyScores() tự thấy fakeBotWeek đổi, nhưng giải đấu giờ tính theo tournamentStartMs
    // riêng của từng người (currWeek lịch không đổi) nên bot cũ vẫn được giữ — tab Leaderboard và
    // LeaderboardPreview còn nguyên điểm/hạng của giải trước, chỉ đồng hồ đếm ngược được đặt lại.
    this.fakeBotScores = null;
    this.fakeBotWeeklyIdentities = null;
  }

  /** DÙNG ĐỂ TEST — giả lập "giải đấu tuần VỪA KẾT THÚC" ngay bây giờ, dựa trên điểm/hạng THẬT
   * hiện tại (không tự xoá dữ liệu ngay) — để test đúng luồng TournamentResultPopup (Top 3, nhận
   * thưởng)/TournamentResetPopup (không Top 3, Got it) y hệt sản xuất thật, thay vì phải đợi tới
   * cuối tuần thật. Việc reset THẬT SỰ (bảng mới toanh) chỉ xảy ra SAU KHI bấm Claim/Got it ở
   * popup — đúng như luồng thật (xem resolvePendingTournamentResult()). Muốn test nhánh Top 3 thì
   * chơi vài màn cho điểm tuần đủ cao TRƯỚC khi bấm nút này; muốn test nhánh không Top 3 thì bấm
   * luôn từ đầu (điểm thấp). */
  resetWeeklyForTesting(): void {
    if (!this.leaderboardDataSave) return;
    // Đảm bảo không có pendingResultRank cũ chặn lại (checkWeekRollover chỉ tính khi đang = 0),
    // rồi ép tournamentStartMs lùi lại hơn 7 ngày để checkWeekRollover() coi như "vừa hết giờ", tự
    // tính đúng hạng hiện tại dựa trên currWeekScore/bot THẬT đang có.
    this.leaderboardDataSave.pendingResultRank = 0;
    this.leaderboardDataSave.tournamentStartMs = Date.now() - TOURNAMENT_DURATION_MS - 1000;
    this.setSaveLeaderboardData();
    this.checkWeekRollover();
  }

  /** Cache điểm 50 bot giả trong tuần — LƯU FILE (xem leaderboardDataSave.fakeBotScores/
   * setSaveLeaderboardData), không còn mất khi tắt app. Bot chỉ "chơi thêm" MỖI KHI người chơi
   * thật thắng 1 màn (xem addCurrWeekScore) — đồng bộ tốc độ leo hạng của bot theo đúng nhịp chơi
   * thật, không lệ thuộc số lần mở màn Leaderboard. */
  private fakeBotScores: number[] | null = null;
  private fakeBotWeek = -1;

  getFakeBotWeeklyScores(): number[] {
    this.checkWeekRollover();
    // Chỉ coi là "sang tuần mới, cần bot mới" khi KHÔNG còn pendingResultRank — nếu đang có kết
    // quả tuần cũ chờ Claim/Continue (this.currWeek đã là tuần MỚI nhưng leaderboardDataSave.currWeek
    // vẫn là tuần CŨ), phải GIỮ NGUYÊN bot cũ để hiển thị đúng bảng xếp hạng cuối cùng cho tới khi
    // resolvePendingTournamentResult() thật sự reset.
    const stillPending = this.leaderboardDataSave?.pendingResultRank > 0;
    if (this.fakeBotScores == null || (this.fakeBotWeek !== this.currWeek && !stillPending)) {
      this.fakeBotScores = this.buildBaselineWeeklyBotScores();
      this.fakeBotWeek = this.currWeek;
      // Bot MỚI (sang tuần/reset) mới cần danh tính (tên + avatar) MỚI — huỷ cache danh tính cũ
      // để getFakeBotWeeklyIdentities() tự tạo lại đúng lúc, KHÔNG sớm hơn (bot cũ còn hiển thị
      // giữ nguyên danh tính cho tới khi thật sự có bot mới thay thế).
      this.fakeBotWeeklyIdentities = null;
      // Lưu NGAY — nếu không, bot vừa random ra chỉ nằm ở bộ nhớ, tắt app trước khi có bất kỳ thay
      // đổi điểm nào (thắng/thua/bù offline, những chỗ vốn đã tự lưu) sẽ mất, lần sau vào lại
      // random ra bộ bot khác — đúng bug "restart lại game thì dữ liệu bot bị reset".
      this.setSaveLeaderboardData();
    }
    return this.fakeBotScores;
  }

  /** Tên + avatar của 50 bot giả Weekly — tạo NGẪU NHIÊN ĐÚNG 1 LẦN mỗi khi fakeBotScores được
   * dựng mới (xem getFakeBotWeeklyScores() ở trên), rồi CACHE lại dùng chung cho mọi lần mở tab
   * Leaderboard sau đó trong cùng phiên chơi. Trước đây LeaderboardGroupWeek.showGroup() tự gọi
   * ProfileManager.getRandomName()/getRandomAvatarURL() MỖI LẦN mở tab (không cache) — khiến bảng
   * xếp hạng "đổi người" liên tục dù điểm số (fakeBotScores) không đổi, dù hạng của người chơi vẫn
   * giữ nguyên (chỉ điểm là ổn định, danh tính bot thì không). */
  private fakeBotWeeklyIdentities: { userName: string; avatarURL: string }[] | null = null;

  getFakeBotWeeklyIdentities(): { userName: string; avatarURL: string }[] {
    const scores = this.getFakeBotWeeklyScores();
    const levels = this.getFakeBotGlobalScores();
    if (this.fakeBotWeeklyIdentities == null) {
      this.fakeBotWeeklyIdentities = scores.map((_, i) => ({
        userName: '' + ProfileManager.instance.getRandomName(),
        avatarURL: ProfileManager.instance.getRandomAvatarURL(levels[i]),
      }));
      // Lưu NGAY — cùng lý do với getFakeBotWeeklyScores(), tránh mất danh tính vừa random nếu
      // tắt app trước lần setSaveLeaderboardData() kế tiếp.
      this.setSaveLeaderboardData();
    }
    return this.fakeBotWeeklyIdentities;
  }

  /** "Online" = ngay lúc người chơi thật vừa kết thúc 1 ván (thắng hoặc thua) — đúng 2 cột đầu
   * trong bảng thiết kế ("% win khi user win" / "% win khi user lose"). */
  private rollWeeklyOnlineGrowth(scores: number[], outcome: WeeklyMatchOutcome, playerScore: number): void {
    for (let i = 0; i < scores.length; i++) {
      const tier = getBotTierByIndex(i, scores.length);
      scores[i] += rollWeeklyPointsOnMatchEnd(tier, outcome, scores[i], playerScore);
    }
  }

  private rollGlobalOnlineGrowth(scores: number[], outcome: WeeklyMatchOutcome, playerScore: number): void {
    for (let i = 0; i < scores.length; i++) {
      const tier = getGlobalBotTierByIndex(i, scores.length);
      scores[i] += rollGlobalPointsOnMatchEnd(tier, outcome, scores[i], playerScore);
    }
  }

  /** "Offline" = tự tăng điểm định kỳ theo thời gian thực, không cần người chơi thắng/thua gì —
   * cột thứ 3 trong bảng thiết kế. Chu kỳ tick (10 phút, hoặc 60 phút nếu bot đã bỏ xa người chơi
   * > 10 điểm) tự đổi theo từng bot qua getOfflineTickMinutes() — CỐ ĐỊNH theo trạng thái NGAY LÚC
   * BẮT ĐẦU bù (không tính lại giữa chừng nếu bot vượt ngưỡng trong lúc đang bù) để đơn giản, chấp
   * nhận sai số nhỏ ở đúng khoảnh khắc bot vừa vượt ngưỡng giữa 1 lần bù dài.
   *
   * Hạng người chơi CHỈ được phép tụt xuống tới rankFloor (ngẫu nhiên trong khoảng
   * OFFLINE_RANK_FLOOR_MIN..MAX mỗi lần bù) — chạm mốc đó thì NGỪNG tăng điểm bot hẳn, dù còn bao
   * nhiêu chu kỳ offline cần bù cũng bỏ qua, đảm bảo người chơi quay lại vẫn leo hạng được. */
  private rollWeeklyOfflineGrowth(scores: number[], playerScore: number, elapsedMs: number, ignoreRankFloorForTesting = false): void {
    // Số chu kỳ CẦN bù cho MỖI bot tính 1 LẦN DUY NHẤT ở đây (tickMinutes CỐ ĐỊNH theo trạng thái
    // ban đầu, giữ đúng hành vi cũ) — nhưng áp dụng theo TỪNG VÒNG (round-robin qua mọi bot) thay
    // vì dồn hết 1 bot rồi mới sang bot kế, để có thể NGẮT NGANG đúng lúc hạng người chơi vừa chạm
    // sàn cho phép (rankFloor), không phải chờ bù xong hẳn 1 bot mới kiểm tra được.
    const tiers = scores.map((_, i) => getBotTierByIndex(i, scores.length));
    const ticksRemaining = scores.map((score) =>
      Math.min(MAX_OFFLINE_TICKS, Math.floor(elapsedMs / (getOfflineTickMinutes(score, playerScore) * 60000))),
    );

    const rankFloor =
      OFFLINE_RANK_FLOOR_MIN + Math.floor(Math.random() * (OFFLINE_RANK_FLOOR_MAX - OFFLINE_RANK_FLOOR_MIN + 1));
    const playerRank = (): number => 1 + scores.filter((s) => s >= playerScore).length;

    for (let round = 0; round < MAX_OFFLINE_TICKS; round++) {
      if (!ignoreRankFloorForTesting && playerRank() >= rankFloor) break;

      let anyTicked = false;
      for (let i = 0; i < scores.length; i++) {
        if (ticksRemaining[i] <= round) continue;
        scores[i] += rollWeeklyPointsOffline(tiers[i]);
        anyTicked = true;
      }
      if (!anyTicked) break;
    }
  }

  private rollGlobalOfflineGrowth(scores: number[], playerScore: number, elapsedMs: number): void {
    for (let i = 0; i < scores.length; i++) {
      const tier = getGlobalBotTierByIndex(i, scores.length);
      const tickMinutes = getOfflineTickMinutes(scores[i], playerScore);
      const ticks = Math.min(MAX_OFFLINE_TICKS, Math.floor(elapsedMs / (tickMinutes * 60000)));
      for (let t = 0; t < ticks; t++) scores[i] += rollGlobalPointsOffline(tier);
    }
  }

  /** Cache điểm 50 bot giả cho Global — KHÔNG lưu file (data mock), KHÔNG reset theo tuần (Global
   * là tổng dồn vĩnh viễn, giống currLevelUnlock của người chơi thật). Bot cũng "chơi thêm" mỗi
   * khi người chơi thắng 1 màn, cùng nhịp với Weekly. */
  private fakeBotGlobalScores: number[] | null = null;

  getFakeBotGlobalScores(): number[] {
    if (this.fakeBotGlobalScores == null) {
      this.fakeBotGlobalScores = [];
      for (let i = 0; i < FAKE_BOT_COUNT; i++) {
        this.fakeBotGlobalScores.push(Math.max(1, Math.round(FAKE_BOT_GLOBAL_TOP_SCORE - (i * FAKE_BOT_GLOBAL_TOP_SCORE) / FAKE_BOT_COUNT)));
      }
    }
    return this.fakeBotGlobalScores;
  }

  /** Tên + avatar của 50 bot giả Global — CACHE 1 LẦN DUY NHẤT (KHÔNG bao giờ reset lại, giống
   * fakeBotGlobalScores ở trên — Global tồn tại vĩnh viễn suốt phiên chơi, không theo tuần). Cùng
   * lý do với getFakeBotWeeklyIdentities(): tránh đổi tên/avatar bot mỗi lần mở lại tab. */
  private fakeBotGlobalIdentities: { userName: string; avatarURL: string }[] | null = null;

  getFakeBotGlobalIdentities(): { userName: string; avatarURL: string }[] {
    const scores = this.getFakeBotGlobalScores();
    if (this.fakeBotGlobalIdentities == null) {
      this.fakeBotGlobalIdentities = scores.map((score) => ({
        userName: '' + ProfileManager.instance.getRandomName(),
        avatarURL: ProfileManager.instance.getRandomAvatarURL(score),
      }));
    }
    return this.fakeBotGlobalIdentities;
  }

  /** weeklyScore: điểm người chơi GHI ĐƯỢC lúc thắng màn vừa xong — Dogdoku dùng số tim còn lại
   * (0..GameConfig.maxMistakes), ConnectTracks dùng số ô đường ray của màn (lớn hơn hẳn, thường
   * 10..50 — xem PuzzleSolvedEventPayload.leaderboardScore/GameManager.pushLeaderboardScore). KHÔNG
   * còn +1 cố định/màn (thắng mà dùng hết tim ở Dogdoku thì không cộng điểm gì cả — đúng nghĩa "để
   * dành"). Hệ thống 9 nhóm tỉ lệ (WeeklyLeagueConfig) chỉ áp dụng cho đối thủ GIẢ trong data mock,
   * lăn cùng lúc người chơi thắng màn để tạo cảm giác leo hạng (bot cũng đang "chơi" chứ không đứng
   * yên) — cho CẢ Weekly lẫn Global; điểm bot mỗi lượt (rollWeeklyBotPoints()) đã rescale khớp
   * thang điểm MỚI này (xem WeeklyLeagueConfig.ts). */
  addCurrWeekScore(weeklyScore: number){
    this.checkWeekRollover();
    // Nếu đang có pendingResultRank (tuần cũ đã hết giờ, đang chờ popup Claim/Continue xử lý) —
    // KHÔNG cộng thêm điểm/bot Weekly nữa (giải đấu tuần đó coi như đã kết thúc, chưa có giải đấu
    // mới để cộng vào) — Global vẫn cộng bình thường (không có khái niệm "kết thúc" theo tuần).
    if (this.leaderboardDataSave.pendingResultRank === 0) {
      this.leaderboardDataSave.currWeekScore += Math.max(0, weeklyScore);
      this.rollWeeklyOnlineGrowth(this.getFakeBotWeeklyScores(), 'win', this.leaderboardDataSave.currWeekScore);
    }
    this.rollGlobalOnlineGrowth(this.getFakeBotGlobalScores(), 'win', localConfig.instance.currLevelUnlock);
    this.setSaveLeaderboardData();
    let strWeekContextID: string = this.getWeekContextID_byWeek(this.currWeek);
    let leaderboardDataInfo: LeaderboardDataInfo = LeaderboardManager.instance.getLeaderBoardDataInfo_byContextID(strWeekContextID);
    if (leaderboardDataInfo != null) {
      PGSPlayInstantManager.instance.UpdatePlayerScore_byLeaderboardID(leaderboardDataInfo._id, this.leaderboardDataSave.currWeekScore);
    }

    let strWorldContextID: string = this.getWorldContextID();
    let leaderboardDataInfoWorld = LeaderboardManager.instance.getLeaderBoardDataInfo_byContextID(strWorldContextID);
    if (leaderboardDataInfoWorld != null) {
      PGSPlayInstantManager.instance.UpdatePlayerScore_byLeaderboardID(leaderboardDataInfoWorld._id, localConfig.instance.currLevelUnlock);
    }


    PGSPlayInstantManager.instance.UpdatePlayerScore(localConfig.instance.currLevelUnlock);
  }

  /** Gọi khi người chơi THẬT vừa THUA 1 màn campaign — người chơi KHÔNG mất/thêm điểm gì (thua
   * không tính điểm), nhưng bot vẫn có % tăng điểm riêng (thấp hơn lúc thắng) theo đúng cột "%
   * win khi user lose" trong bảng thiết kế — trước đây bot ĐỨNG YÊN hoàn toàn khi người chơi thua. */
  addLoseAttempt(): void {
    this.checkWeekRollover();
    if (this.leaderboardDataSave.pendingResultRank === 0) {
      this.rollWeeklyOnlineGrowth(this.getFakeBotWeeklyScores(), 'lose', this.leaderboardDataSave.currWeekScore);
    }
    this.rollGlobalOnlineGrowth(this.getFakeBotGlobalScores(), 'lose', localConfig.instance.currLevelUnlock);
    this.setSaveLeaderboardData();
  }

  currWeek: number = 0;
  initCurrWeek() {
    // console.log("initCurrWeek");
    let oneDay = 24 * 60 * 60 * 1000;
    let startDate = new Date(2025, 10, 3);
    let currentdate = new Date();
    let countDays: number = Math.floor((currentdate.getTime() - startDate.getTime()) / oneDay);

    this.currWeek = Math.floor(countDays / 7);
    // console.log("this.currWeek", this.currWeek);
  }

  getTimeToNextDay() {
    let currDate = new Date();
    //console.log("getTimeToNextDaygetTimeToNextDaygetTimeToNextDay");
    //console.log(currDate.getTime());
    let lastDate = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
    //console.log(lastDate.getTime());

    return Math.floor((lastDate.getTime() - currDate.getTime()) / 1000) + 86400;
  }

  /** Số giây còn lại tới khi giải đấu Weekly CỦA CHÍNH NGƯỜI CHƠI NÀY hết hạn — 7 ngày kể từ
   * tournamentStartMs riêng của họ (không phải lịch chung thứ 2 hàng tuần nữa). 0 nếu đã hết hạn
   * (đang chờ pendingResultRank được xử lý ở popup Claim/Got it). */
  getTimeToNextWeek() {
    this.checkWeekRollover();
    const remainingMs = this.leaderboardDataSave.tournamentStartMs + TOURNAMENT_DURATION_MS - Date.now();
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  arrLeaderBoardDataInfos: LeaderboardDataInfo[] = [];
  mapLeaderBoard_ItemRankInfos: Map<string, ItemRankInfo[]> = new Map();
  mapLeaderBoard_Totals: Map<string, number> = new Map();
  mapLeaderBoard_MyScores: Map<string, number> = new Map();

  

  getWeekContextID_byWeek(indexWeek: number) {
    return Constants.PGS_GAMEID + "_week_" + indexWeek;
  }

  getWorldContextID() {
    return Constants.PGS_GAMEID + "_world";
  }

  getLeaderBoardDataInfo_byContextID(contextID: string) {
    for (let i = 0; i < this.arrLeaderBoardDataInfos.length; i++) {
      if (this.arrLeaderBoardDataInfos[i].contextId == contextID) {
        return this.arrLeaderBoardDataInfos[i];
      }
    }
    return null;
  }

  getListItemRankInfos_byLeaderboardId(leaderboardId: string) {
    if (this.mapLeaderBoard_ItemRankInfos.has(leaderboardId)) {
      return this.mapLeaderBoard_ItemRankInfos.get(leaderboardId).filter(item => item.userScore > 0);
    }
    return [];
  }

  getLeaderboardMyScore_byID(leaderboardId: string) {
    if (this.mapLeaderBoard_MyScores.has(leaderboardId)) {
      return this.mapLeaderBoard_MyScores.get(leaderboardId);
    }
    return 0;
  }

  setLeaderboardMyScore_byID(leaderboardId: string, score: number) {
    this.mapLeaderBoard_MyScores.set(leaderboardId, score);
  }

  setLeaderboardTotal_byID(leaderboardId: string, total: number) {
    this.mapLeaderBoard_Totals.set(leaderboardId, total);
  } 

  getLeaderboardTotal_byID(leaderboardId: string) {
    if (this.mapLeaderBoard_Totals.has(leaderboardId)) {
      return this.mapLeaderBoard_Totals.get(leaderboardId);
    }
    return 0;
  } 

  setLeaderboardItemRankInfos_byID(leaderboardId: string, listItemRankInfos: ItemRankInfo[]) {
    this.mapLeaderBoard_ItemRankInfos.set(leaderboardId, listItemRankInfos);
  }

  getLeaderboardItemRankInfos_byID(leaderboardId: string) {
    if (this.mapLeaderBoard_ItemRankInfos.has(leaderboardId)) {
      return this.mapLeaderBoard_ItemRankInfos.get(leaderboardId);
    }
    return [];
  }

  getLastWeeklyReward(){
    //
    // console.log("getLastWeeklyReward", this.leaderboardDataSave.currWeek);
    if(this.leaderboardDataSave.currWeek < 2) return 100;
    if(this.leaderboardDataSave.lastWeekCheckReward == this.currWeek) return 100;
    let lastWeekContextID:string = LeaderboardManager.instance.getWeekContextID_byWeek(LeaderboardManager.instance.currWeek - 1);
    let leaderboardDataInfo: LeaderboardDataInfo = LeaderboardManager.instance.getLeaderBoardDataInfo_byContextID(lastWeekContextID);
    if(leaderboardDataInfo != null){
      let arrListRankInfos:ItemRankInfo[] = LeaderboardManager.instance.getLeaderboardItemRankInfos_byID(leaderboardDataInfo._id);
      // console.log("arrListRankInfos",arrListRankInfos);
      if(arrListRankInfos.length > 0){
        this.leaderboardDataSave.lastWeekCheckReward = this.currWeek;
        this.setSaveLeaderboardData();

        let myIndexRank: number = arrListRankInfos.findIndex(item => item.isMyRank == true);
        // console.log("myIndexRank",myIndexRank);
        if (myIndexRank < 3 && myIndexRank >= 0) {
          return myIndexRank;
        }
      }
      
    }
    return 100;
  }
}

export enum LEADERBOARD_TAB_TYPE{
  WEEK = 0,
  WORLD = 1
}
Enum(LEADERBOARD_TAB_TYPE);


