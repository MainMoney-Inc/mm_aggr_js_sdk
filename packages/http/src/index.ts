export interface CreateHttpOptions {
  merchantBackendUrl: string;
}

export function createHttp(options: { merchantBackendUrl: string }): { merchantBackendUrl: string } {
  return { merchantBackendUrl: options.merchantBackendUrl };
}
