
export interface IPGSPlayInstantManager {
    isAvailable(): boolean;

    get<T>(path: string, query?: Record<string, string>): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    put<T>(path: string, body: unknown): Promise<T>;
}
