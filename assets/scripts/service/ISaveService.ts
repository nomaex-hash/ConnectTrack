
export interface ISaveService {
    read(): Promise<string | null>;
    write(json: string): Promise<void>;
}
