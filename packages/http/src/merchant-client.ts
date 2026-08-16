/** JSON client for merchantBackendUrl only. Never sends aggregator API keys. */

import {
  MerchantBackendException,
  joinUrl,
  type Session,
} from "@mainmoney/js-core";

import { FetchHttpClient } from "./fetch-client.js";
import type { HttpClient, QueryValue, RequestOptions } from "./http-client.js";

export type MerchantHttp = {
  get<T = unknown>(path: string, query?: Record<string, QueryValue>, extraHeaders?: Record<string, string>): Promise<T>;
  post<T = unknown>(
    path: string,
    json?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<T>;
};

export type CreateHttpOptions = {
  merchantBackendUrl: string;
  http?: HttpClient;
};

export function createHttp(session: Session, http?: HttpClient): MerchantHttp {
  const client = http ?? new FetchHttpClient(session.fetch, session.timeoutMs);
  const request = async <T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> => {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (session.clientToken !== undefined && session.clientToken !== "") {
      headers.Authorization ??= `Bearer ${session.clientToken}`;
    }
    const uri = joinUrl(session.merchantBackendUrl, path);
    const response = await client.request(method, uri, { ...options, headers });
    return decodeJson<T>(response.status, response.bodyText);
  };

  return {
    get: (path, query, extraHeaders) => request("GET", path, { query, headers: extraHeaders }),
    post: (path, json, extraHeaders) => request("POST", path, { json, headers: extraHeaders }),
  };
}

export function decodeJson<T>(statusCode: number, bodyText: string): T {
  let parsed: unknown = null;
  if (bodyText !== "") {
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch {
      parsed = bodyText;
    }
  }
  if (statusCode < 200 || statusCode >= 300) {
    throw exceptionFromBody(statusCode, parsed);
  }
  return unwrapEnvelope(parsed) as T;
}

function unwrapEnvelope(parsed: unknown): unknown {
  if (!isPlainObject(parsed)) {
    return parsed;
  }
  if ("success" in parsed && "response_data" in parsed) {
    if (parsed.success === false) {
      throw exceptionFromBody(400, parsed);
    }
    return parsed.response_data;
  }
  return parsed;
}

function exceptionFromBody(statusCode: number, parsed: unknown): MerchantBackendException {
  if (isPlainObject(parsed)) {
    const message = typeof parsed.message === "string" ? parsed.message : "Merchant backend request failed";
    const responseData = parsed.response_data;
    let errors: Record<string, unknown> = {};
    if (isPlainObject(responseData) && isPlainObject(responseData.errors)) {
      errors = responseData.errors;
    } else if (isPlainObject(parsed.errors)) {
      errors = parsed.errors;
    }
    return new MerchantBackendException(message, statusCode, errors, parsed);
  }
  return new MerchantBackendException("Merchant backend request failed", statusCode, {}, parsed);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
