export type SafeEvalResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export declare function safeEvaluate(code: string, timeout?: number): SafeEvalResult;
