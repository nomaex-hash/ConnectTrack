import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ callbacks: [] as Function[], avatars: new Map(), frames: new Map() }));
vi.mock('cc', () => ({
    _decorator: { ccclass: () => (t: unknown) => t, property: () => {} },
    Component: class {}, Node: class {}, Prefab: class {}, BlockInputEvents: class {}, UITransform: class {},
    isValid: (v: any) => !!v && v.valid !== false,
}));
vi.mock('../../../assets/scripts/profile/ProfilePopup', () => ({ ProfilePopup: class {} }));
vi.mock('../../../assets/scripts/profile/ProfileEditPopup', () => ({ ProfileEditPopup: class {} }));
vi.mock('../../../assets/scripts/framework/clientEvent', () => ({ clientEvent: { off: vi.fn() } }));
vi.mock('../../../assets/scripts/framework/constants', () => ({ Constants: {} }));
vi.mock('../../../assets/scripts/profile/ProfileManager', () => ({
    PROFILE_TAB_TYPE: { AVATAR: 0, FRAME: 1 },
    ProfileManager: { instance: {
        avatarDataDetails: [{ Id: 0 }, { Id: 1 }], frameDataDetails: [{ Id: 0 }],
        getPathAvatar_byID: (id: number) => `avatar_${id}`, getPathFrame_byID: (id: number) => `frame_${id}`,
    } },
}));
vi.mock('../../../assets/scripts/framework/MConfigResourceUtils', () => ({ MConfigResourceUtils: {
    mapLoadedAvatars: state.avatars, mapLoadedFrames: state.frames,
    getProfileSpriteFrame: (type: number, path: string, cb: Function) => state.callbacks.push((err?: Error) => {
        const frame = err ? null : {};
        if (frame) (type === 0 ? state.avatars : state.frames).set(path, frame);
        cb(err, frame);
    }),
} }));
import { ProfilePopupHolder } from '../../../assets/scripts/profile/ProfilePopupHolder';
beforeEach(() => { state.callbacks = []; state.avatars.clear(); state.frames.clear(); });
function holder() {
    const h = new ProfilePopupHolder() as any;
    h.profileEditPopupPrefab = {};
    h.showLoading = vi.fn(); h.clearLoading = vi.fn(); h.openProfileEditPopup = vi.fn();
    return h;
}
it('waits for all avatars and frames, suppresses repeated clicks, then reuses cache', async () => {
    const h = holder(); const pending = h.showProfileEditPopup();
    await h.showProfileEditPopup();
    expect(state.callbacks).toHaveLength(3); expect(h.showLoading).toHaveBeenCalledTimes(1);
    state.callbacks[0](); state.callbacks[1](); await Promise.resolve();
    expect(h.openProfileEditPopup).not.toHaveBeenCalled();
    state.callbacks[2](); await pending;
    expect(h.openProfileEditPopup).toHaveBeenCalledTimes(1);
    await h.showProfileEditPopup();
    expect(state.callbacks).toHaveLength(3); expect(h.showLoading).toHaveBeenCalledTimes(1);
});
it('handles failure without opening and allows retry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = holder(); const pending = h.showProfileEditPopup();
    state.callbacks[0](new Error('missing')); state.callbacks[1](); state.callbacks[2]();
    await pending; expect(h.openProfileEditPopup).not.toHaveBeenCalled(); expect(h.pendingOpen).toBeNull();
    const retry = h.showProfileEditPopup(); state.callbacks[3](); await retry;
    expect(h.openProfileEditPopup).toHaveBeenCalledTimes(1); warn.mockRestore();
});
it('does not open after the holder is disabled during loading', async () => {
    const h = holder(); const pending = h.showProfileEditPopup(); h.onDisable();
    for (const cb of state.callbacks) cb(); await pending;
    expect(h.openProfileEditPopup).not.toHaveBeenCalled(); expect(h.clearLoading).toHaveBeenCalled();
});
