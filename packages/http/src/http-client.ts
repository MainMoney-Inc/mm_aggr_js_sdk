/** Injectable HTTP client for merchant-backend calls. */

export type QueryValue = string | number | boolean | undefined;

export type RequestOptions = {
  headers?: Record<string, string>;
  json?: Record<string, unknown>;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

export interface HttpClient {
  request(method: string, uri: string, options?: RequestOptions): Promise<{ status: number; bodyText: string }>;
}
