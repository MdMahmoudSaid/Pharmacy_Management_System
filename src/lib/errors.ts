export const APP_ERROR_CODES = [
  'AUTHENTICATION_FAILED',
  'RATE_LIMITED',
  'SESSION_REQUIRED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'SHIFT_REQUIRED',
  'SHIFT_ALREADY_OPEN',
  'INSUFFICIENT_STOCK',
  'INTERNAL_ERROR'
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message = code
  ) {
    super(message);
    this.name = 'AppError';
  }
}
