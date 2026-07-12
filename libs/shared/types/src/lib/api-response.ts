export interface ApiResponse<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RealtimeChannel {
  channel: string;
  event: string;
  payload: unknown;
}