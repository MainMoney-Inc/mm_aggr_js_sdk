export interface CreateCheckoutOptions {
  merchantBackendUrl: string;
}

export function createCheckout(options: { merchantBackendUrl: string }): { merchantBackendUrl: string } {
  return { merchantBackendUrl: options.merchantBackendUrl };
}
