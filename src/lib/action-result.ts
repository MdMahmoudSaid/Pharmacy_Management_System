import type {AppErrorCode} from './errors';

export type ActionResult<T> =
  | {ok: true; data: T}
  | {
      ok: false;
      code: AppErrorCode;
      fieldErrors?: Record<string, string[]>;
    };
