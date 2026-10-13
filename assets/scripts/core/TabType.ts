import { ccenum } from 'cc';

/**
 * Các tab chính trên thanh bottom bar màn Home — mirror TAB_TYPE gốc, CHỈ giữ 3 giá trị
 * Dogdoku thật sự dùng (bản gốc còn SOCIAL/TOURNAMENT cho tính năng chưa tồn tại ở đây).
 */
export enum TAB_TYPE {
    SHOP = 0,
    HOME = 1,
    LEADERBOARD = 2,
}
// Bắt buộc — thiếu dòng này thì @property({ type: TAB_TYPE }) không hiện dropdown trong
// Inspector (chỉ hiện ô trống), vì CCClass không tự nhận diện enum TS thường.
ccenum(TAB_TYPE);
