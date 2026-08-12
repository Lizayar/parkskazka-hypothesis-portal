export type AdapterErrorCode =
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_PERIOD"
  | "INVALID_TIMEZONE"
  | "INVALID_SCHEMA"
  | "INVALID_CURRENCY"
  | "INVALID_HIERARCHY"
  | "INVALID_UTM"
  | "INVALID_CREATIVE"
  | "SOURCE_FAILURE";

export class AdapterError extends Error {
  constructor(
    readonly code: AdapterErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(`${code}: ${message}`);
    this.name = "AdapterError";
  }
}

