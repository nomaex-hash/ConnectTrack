import { sys } from 'cc';
import { ISaveService } from './ISaveService';

const STORAGE_KEY = 'dogdoku_save_data';


export class LocalSaveService implements ISaveService {
    async read(): Promise<string | null> {
        return sys.localStorage.getItem(STORAGE_KEY);
    }

    async write(json: string): Promise<void> {
        sys.localStorage.setItem(STORAGE_KEY, json);
    }
}
