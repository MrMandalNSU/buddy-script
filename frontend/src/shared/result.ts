export type AppErrorCode = "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "UNKNOWN";
export type AppError = { code: AppErrorCode; message: string; fieldErrors?: Record<string, string> };
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (code: AppErrorCode, message: string): Result<never> => ({ ok: false, error: { code, message } });
