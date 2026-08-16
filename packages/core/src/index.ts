export interface CreateSessionOptions {
  merchantBackendUrl: string;
}

export function createSession(options: { merchantBackendUrl: string }): { merchantBackendUrl: string } {
  return { merchantBackendUrl: options.merchantBackendUrl };
}
