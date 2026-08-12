export type AdapterErrorCode =
  | "UNSUPPORTED_CAPABILITY"
  | "INVALID_PERIOD"
  | "INVALID_TIMEZONE"
  | "INVALID_SCHEMA"
  | "SOURCE_FAILURE";

export class AdapterError extends Error {
  constructor(
    readonly code: AdapterErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

