export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  };
  meta: ApiMeta;
}

export function successEnvelope<T>(data: T, requestId: string): SuccessEnvelope<T> {
  return { success: true, data, meta: { requestId, timestamp: new Date().toISOString() } };
}

export function errorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details?: Readonly<Record<string, unknown>>,
): ErrorEnvelope {
  const error = details === undefined ? { code, message } : { code, message, details };
  return { success: false, error, meta: { requestId, timestamp: new Date().toISOString() } };
}
