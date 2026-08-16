/** Exceptions raised by the MainMoney JS/TS frontend SDK. */

export class FrontendSdkException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontendSdkException";
  }
}

export class ConfigurationException extends FrontendSdkException {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationException";
  }
}

export class CurrencyMismatchException extends FrontendSdkException {
  constructor(message = "Cannot mix monetary amounts across currencies") {
    super(message);
    this.name = "CurrencyMismatchException";
  }
}

export class MerchantBackendException extends FrontendSdkException {
  readonly statusCode: number;
  readonly errors: Record<string, unknown>;
  readonly responseBody: unknown;

  constructor(
    message: string,
    statusCode: number,
    errors: Record<string, unknown> = {},
    responseBody: unknown = null,
  ) {
    super(message);
    this.name = "MerchantBackendException";
    this.statusCode = statusCode;
    this.errors = errors;
    this.responseBody = responseBody;
  }
}
