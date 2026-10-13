import { describe, it, expect } from 'vitest';
import { DailyPuzzleService } from '../../assets/scripts/service/DailyPuzzleService';
import { DailyPuzzleData } from '../../assets/scripts/model/DailyPuzzleData';
import { RankTier } from '../../assets/scripts/core/RankTier';
import { GameConfig } from '../../assets/scripts/config/GameConfig';
import { StreakConfig } from '../../assets/scripts/config/StreakConfig';
import { LevelListConfig } from '../../assets/scripts/config/LevelListConfig';

function makeService(overrides: Partial<DailyPuzzleData> = {}) {
    const data: DailyPuzzleData = {
        lastDailyDate: null,
        lastDailySeconds: null,
        lastDailyRank: null,
        streak: 0,
        bestStreak: 0,
        streakLastDate: null,
        streakAnchorDate: null,
        checkedDates: [],
        rewardClaimedForAnchor: false,
        ...overrides,
    };
    return { service: new DailyPuzzleService(data), data };
}

describe('DailyPuzzleService — chọn puzzle theo ngày (02 — mục 3)', () => {
    it('cùng ngày → cùng puzzle (tất định, mọi người chơi giống nhau)', () => {
        const { service } = makeService();
        expect(service.getPuzzleIdFor('2026-07-14')).toBe(service.getPuzzleIdFor('2026-07-14'));
    });

    it('id luôn nằm trong pool daily', () => {
        const { service } = makeService();
        for (let day = 1; day <= 28; day++) {
            const date = `2026-02-${day < 10 ? '0' : ''}${day}`;
            const id = service.getPuzzleIdFor(date);
            expect(id).toBeGreaterThanOrEqual(1);
            expect(id).toBeLessThanOrEqual(LevelListConfig.dailyPuzzleCount);
        }
    });

    it('ngày khác nhau nói chung cho puzzle khác nhau', () => {
        const { service } = makeService();
        const ids = new Set<number>();
        for (let day = 1; day <= 20; day++) {
            ids.add(service.getPuzzleIdFor(`2026-03-${day < 10 ? '0' : ''}${day}`));
        }
        expect(ids.size).toBeGreaterThan(15);
    });
});

describe('DailyPuzzleService — daily challenge (tách khỏi streak)', () => {
    it('isDailyDoneToday suy ra từ ngày, không lưu cờ riêng', () => {
        const { service } = makeService({ lastDailyDate: '2026-07-14' });
        expect(service.isDailyDoneToday('2026-07-14')).toBe(true);
        expect(service.isDailyDoneToday('2026-07-15')).toBe(false);
    });

    it('người chơi mới: chưa hoàn thành', () => {
        const { service } = makeService();
        expect(service.isDailyDoneToday('2026-07-14')).toBe(false);
    });

    it('hoàn thành lần đầu trong ngày → thưởng + lưu thời gian và hạng', () => {
        const { service, data } = makeService();
        const result = service.completeDailyChallenge(90, RankTier.Gold, '2026-07-14');

        expect(result.firstToday).toBe(true);
        expect(result.placeDogCharges).toBe(GameConfig.dailyRewardPlaceDogCharges);
        expect(data.lastDailyDate).toBe('2026-07-14');
        expect(service.lastDailySeconds).toBe(90);
        expect(service.lastDailyRank).toBe(RankTier.Gold);
    });

    it('chơi lại trong cùng ngày → KHÔNG thưởng nữa, nhưng vẫn cập nhật kết quả', () => {
        const { service } = makeService({ lastDailyDate: '2026-07-14' });
        const result = service.completeDailyChallenge(60, RankTier.Silver, '2026-07-14');

        expect(result.firstToday).toBe(false);
        expect(result.placeDogCharges).toBe(0);
        expect(service.lastDailySeconds).toBe(60);
        expect(service.lastDailyRank).toBe(RankTier.Silver);
    });
});

describe('DailyPuzzleService — streak (mọi màn thắng, 1 lần/ngày)', () => {
    it('lần đầu → streak = 1 và cập nhật chuỗi tốt nhất', () => {
        const { service, data } = makeService();
        const result = service.recordActivity('2026-07-14');

        expect(result.firstToday).toBe(true);
        expect(result.streak).toBe(1);
        expect(data.streakLastDate).toBe('2026-07-14');
        expect(service.bestStreak).toBe(1);
    });

    it('chơi liền ngày → streak + 1', () => {
        const { service } = makeService({ streakLastDate: '2026-07-13', streak: 5 });
        expect(service.recordActivity('2026-07-14').streak).toBe(6);
    });

    it('thắng thêm màn trong cùng ngày → không cộng nữa (idempotent)', () => {
        const { service } = makeService({ streakLastDate: '2026-07-14', streak: 5 });
        const result = service.recordActivity('2026-07-14');

        expect(result.firstToday).toBe(false);
        expect(result.streak).toBe(5);
    });

    it('đồng hồ máy lùi về quá khứ → bỏ qua, không phá chuỗi', () => {
        const { service } = makeService({ streakLastDate: '2026-07-14', streak: 5 });
        const result = service.recordActivity('2026-07-10');

        expect(result.firstToday).toBe(false);
        expect(result.streak).toBe(5);
    });

    it('chuỗi tốt nhất chỉ tiến, không lùi khi chuỗi hiện tại reset', () => {
        const { service, data } = makeService({
            streakLastDate: '2026-07-01',
            streak: 20,
            bestStreak: 20,
        });

        service.recordActivity('2026-07-14'); // cách quá xa → reset về 1
        expect(data.streak).toBe(1);
        expect(service.bestStreak).toBe(20);
    });
});

describe('DailyPuzzleService — bỏ lỡ ngày reset chuỗi ngay lập tức (không khoan hồng)', () => {
    it('bỏ lỡ đúng 1 ngày → streak reset về 1', () => {
        const { service, data } = makeService({
            streakLastDate: '2026-07-12',
            streak: 5,
        });

        expect(service.recordActivity('2026-07-14').streak).toBe(1);
        expect(data.streak).toBe(1);
    });

    it('bỏ lỡ nhiều ngày → streak vẫn reset về 1, không cộng dồn', () => {
        const { service, data } = makeService({
            streakLastDate: '2026-07-01',
            streak: 30,
        });

        expect(service.recordActivity('2026-07-14').streak).toBe(1);
        expect(data.streak).toBe(1);
    });

    it('chơi đúng ngày kế tiếp (gap = 1) → streak vẫn tăng bình thường', () => {
        const { service, data } = makeService({
            streakLastDate: '2026-07-13',
            streak: 8,
        });

        expect(service.recordActivity('2026-07-14').streak).toBe(9);
        expect(data.streak).toBe(9);
    });
});

describe('DailyPuzzleService — dãy điểm danh (chu kỳ tuần lăn)', () => {
    it('lần đầu ghi nhận → neo cửa sổ vào hôm đó, tích đúng ngày đó', () => {
        const { service, data } = makeService();
        service.recordActivity('2026-07-14');

        expect(data.streakAnchorDate).toBe('2026-07-14');
        expect(data.checkedDates).toEqual(['2026-07-14']);

        const board = service.getStreakBoard('2026-07-14');
        expect(board.days).toHaveLength(StreakConfig.windowDays);
        expect(board.days[0]?.date).toBe('2026-07-14');
        expect(board.days[0]?.checked).toBe(true);
        expect(board.days[1]?.checked).toBe(false);
    });

    it('ô CUỐI của cửa sổ là ô thưởng, các ô khác thì không', () => {
        const { service } = makeService({ streakAnchorDate: '2026-07-14' });
        const board = service.getStreakBoard('2026-07-14');

        const last = StreakConfig.windowDays - 1;
        expect(board.days[last]?.isReward).toBe(true);
        expect(board.days[last]?.date).toBe('2026-07-20'); // neo + 6 ngày
        for (let i = 0; i < last; i++) {
            expect(board.days[i]?.isReward).toBe(false);
        }
    });

    it('tích đủ tới ô cuối → rewardReady', () => {
        const { service } = makeService({
            streakAnchorDate: '2026-07-14',
            checkedDates: ['2026-07-20'],
        });

        expect(service.getStreakBoard('2026-07-20').rewardReady).toBe(true);
    });

    it('chưa tích ô cuối → chưa có thưởng', () => {
        const { service } = makeService({
            streakAnchorDate: '2026-07-14',
            checkedDates: ['2026-07-14', '2026-07-15'],
        });

        expect(service.getStreakBoard('2026-07-15').rewardReady).toBe(false);
    });

    it('qua khỏi ô cuối → TÁI NEO chu kỳ mới tại ngày đó', () => {
        const { service, data } = makeService({
            streakAnchorDate: '2026-07-14',
            checkedDates: ['2026-07-14', '2026-07-20'],
            streakLastDate: '2026-07-20',
            streak: 7,
        });

        service.recordActivity('2026-07-21'); // ngoài cửa sổ 14..20

        expect(data.streakAnchorDate).toBe('2026-07-21');
        expect(data.checkedDates).toEqual(['2026-07-21']);
        expect(data.rewardClaimedForAnchor).toBe(false);
        expect(data.streak).toBe(8); // chuỗi tổng vẫn chạy tiếp
    });

    it('chưa kích hoạt bao giờ → xem trước dãy rỗng neo từ hôm nay', () => {
        const { service } = makeService();
        const board = service.getStreakBoard('2026-07-14');

        expect(board.days[0]?.date).toBe('2026-07-14');
        expect(board.days.every((d) => !d.checked)).toBe(true);
        expect(board.streak).toBe(0);
        expect(board.rewardReady).toBe(false);
    });
});

describe('DailyPuzzleService — nhận quà cuối chu kỳ', () => {
    it('đã tới ngày quà & chưa nhận → nhận được, đánh dấu đã nhận', () => {
        const { service, data } = makeService({
            streakAnchorDate: '2026-07-14',
            checkedDates: ['2026-07-20'], // ô cuối (anchor+6) được tích
            rewardClaimedForAnchor: false,
        });

        expect(service.getStreakBoard('2026-07-20').rewardReady).toBe(true);
        expect(service.getStreakBoard('2026-07-20').rewardClaimed).toBe(false);

        const reward = service.claimReward('2026-07-20');
        expect(reward).toBe(StreakConfig.rewardPlaceDogCharges);
        expect(data.rewardClaimedForAnchor).toBe(true);
        expect(service.getStreakBoard('2026-07-20').rewardClaimed).toBe(true);
    });

    it('nhận lần hai → không được gì', () => {
        const { service } = makeService({
            streakAnchorDate: '2026-07-14',
            checkedDates: ['2026-07-20'],
            rewardClaimedForAnchor: true,
        });
        expect(service.claimReward('2026-07-20')).toBe(0);
    });

    it('chưa tới ngày quà → không nhận được', () => {
        const { service } = makeService({
            streakAnchorDate: '2026-07-14',
            checkedDates: ['2026-07-14'], // mới ngày đầu
        });
        expect(service.claimReward('2026-07-14')).toBe(0);
    });

    it('sang tuần mới (qua ô cuối) → chu kỳ tái neo, cờ đã-nhận reset', () => {
        const { service, data } = makeService({
            streakAnchorDate: '2026-07-14',
            checkedDates: ['2026-07-20'],
            streakLastDate: '2026-07-20',
            streak: 7,
            rewardClaimedForAnchor: true, // đã nhận tuần trước
        });

        service.recordActivity('2026-07-21'); // ngoài cửa sổ 14..20
        expect(data.streakAnchorDate).toBe('2026-07-21');
        expect(data.rewardClaimedForAnchor).toBe(false); // quà tuần mới lại đóng
    });
});
