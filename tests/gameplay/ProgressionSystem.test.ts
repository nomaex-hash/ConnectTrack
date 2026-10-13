import { describe, it, expect } from 'vitest';
import { ProgressionSystem } from '../../assets/scripts/gameplay/progression/ProgressionSystem';
import { LevelProgressData } from '../../assets/scripts/model/LevelProgressData';
import { LevelListConfig } from '../../assets/scripts/config/LevelListConfig';

function makeProgression(highestLevel = 0): {
    system: ProgressionSystem;
    data: LevelProgressData;
} {
    const data: LevelProgressData = { highestLevel };
    return { system: new ProgressionSystem(data), data };
}

describe('ProgressionSystem — mở khóa tuyến tính từ MỘT mốc highestLevel', () => {
    it('người chơi mới: chỉ level 1 mở', () => {
        const { system } = makeProgression();

        expect(system.getCurrentLevel()).toBe(1);
        expect(system.isUnlocked(1)).toBe(true);
        expect(system.isUnlocked(2)).toBe(false);
        expect(system.completedCount).toBe(0);
    });

    it('hoàn thành tới level N → mở level N+1', () => {
        const { system } = makeProgression(3);

        expect(system.getCurrentLevel()).toBe(4);
        expect(system.isCompleted(3)).toBe(true);
        expect(system.isUnlocked(3)).toBe(true); // đã xong
        expect(system.isUnlocked(4)).toBe(true); // đang mở
        expect(system.isUnlocked(5)).toBe(false); // còn khóa
        expect(system.completedCount).toBe(3);
    });

    it('markCompleted đẩy mốc và trả về level vừa mở khóa', () => {
        const { system, data } = makeProgression();

        expect(system.markCompleted(1)).toBe(2);
        expect(data.highestLevel).toBe(1);
        expect(system.isUnlocked(2)).toBe(true);
    });

    it('chơi lại level đã xong → không đổi mốc', () => {
        const { system, data } = makeProgression(2);

        expect(system.markCompleted(1)).toBeNull();
        expect(system.markCompleted(2)).toBeNull();
        expect(data.highestLevel).toBe(2); // mốc chỉ tiến, không lùi
    });

    it('level ngoài phạm vi campaign bị từ chối', () => {
        const { system, data } = makeProgression();

        expect(system.markCompleted(0)).toBeNull();
        expect(system.markCompleted(LevelListConfig.campaignLevelCount + 1)).toBeNull();
        expect(data.highestLevel).toBe(0);
        expect(system.isUnlocked(0)).toBe(false);
        expect(system.isUnlocked(LevelListConfig.campaignLevelCount + 1)).toBe(false);
    });

    it('hoàn thành toàn bộ campaign → không còn level đang mở', () => {
        const { system } = makeProgression(LevelListConfig.campaignLevelCount);

        expect(system.getCurrentLevel()).toBeNull();
        expect(system.markCompleted(LevelListConfig.campaignLevelCount)).toBeNull();
        expect(system.completedCount).toBe(LevelListConfig.campaignLevelCount);
    });

    it('dữ liệu hỏng (âm / vượt trần) được kẹp về khoảng hợp lệ', () => {
        expect(makeProgression(-5).system.completedCount).toBe(0);
        expect(makeProgression(-5).system.getCurrentLevel()).toBe(1);

        const over = makeProgression(LevelListConfig.campaignLevelCount + 99);
        expect(over.system.completedCount).toBe(LevelListConfig.campaignLevelCount);
        expect(over.system.getCurrentLevel()).toBeNull();
    });
});
