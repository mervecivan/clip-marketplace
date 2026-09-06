export const APP_ERROR = {
  BUDGET_EXCEEDED: "BUDGET_EXCEEDED",
} as const;

export type AppErrorCode = (typeof APP_ERROR)[keyof typeof APP_ERROR];

export class AppError extends Error {
  readonly appError: AppErrorCode;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.appError = code;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
