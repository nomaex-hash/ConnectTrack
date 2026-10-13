import { SessionProgress } from '../session/sessionProgress';

/** Platform storage is outside Application. Read values remain untrusted until restored. */
export interface SessionProgressPort {
    read(key: string): unknown;
    write(key: string, progress: SessionProgress): void;
    remove(key: string): void;
}
