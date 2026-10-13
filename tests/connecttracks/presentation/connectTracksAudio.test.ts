import { expect, it, vi } from 'vitest';
vi.mock('cc', () => ({ _decorator: { ccclass: () => (t: unknown) => t, property: () => () => {} }, Component: class {}, AudioClip: class {}, AudioSource: class {}, Node: class {} }));
import { AudioManager } from '../../../assets/scripts/manager/AudioManager';
function snapshot(state: string, links: string[] = [], phase = 'Active') {
 return { cellStates: [state], cellLinks: [links], mainTrackCells: [], mistakes: 0, phase } as any;
}
it('chooses creation and switching clips and ignores unchanged redraws', () => {
 const a = new AudioManager() as any; a.play = vi.fn();
 Object.assign(a, { createPreviewClip: 'preview', createTrackClip: 'track', switchTrackClip: 'switch', switchPreviewClip: 'partial' });
 a.playTrackChanges(snapshot('Empty'), snapshot('TrackPreview')); expect(a.play).toHaveBeenLastCalledWith('preview');
 a.playTrackChanges(snapshot('TrackPreview'), snapshot('Track',['Up','Down'])); expect(a.play).toHaveBeenLastCalledWith('track');
 a.playTrackChanges(snapshot('Track',['Up','Down']), snapshot('Track',['Up','Left'])); expect(a.play).toHaveBeenLastCalledWith('switch');
 a.play.mockClear(); a.playTrackChanges(snapshot('Track',['Up','Left']),snapshot('Track',['Left','Up'])); expect(a.play).not.toHaveBeenCalled();
});
it('plays win only on transition and stops train audio', () => {
 const a = new AudioManager() as any; a.play = vi.fn(); a.levelWinClip = 'win';
 a.playTrackChanges(snapshot('Track'),snapshot('Track',[],'Won')); expect(a.play).toHaveBeenCalledExactlyOnceWith('win');
 a.play.mockClear(); a.playTrackChanges(snapshot('Track',[],'Won'),snapshot('Track',[],'Won')); expect(a.play).not.toHaveBeenCalled();
 a.trainSource = { stop: vi.fn() }; a.stopTrainSound(); expect(a.trainSource.stop).toHaveBeenCalledTimes(1);
});
