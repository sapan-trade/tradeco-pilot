import { TRPCError } from "@trpc/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "QUOTA_EXCEEDED"
  | "BILLING_REQUIRED"
  | "UPSTREAM_FAILED"
  | "CONFLICT";

const TRPC_MAP: Record<ApiErrorCode, TRPCError["code"]> = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "BAD_REQUEST",
  QUOTA_EXCEEDED: "TOO_MANY_REQUESTS",
  BILLING_REQUIRED: "PRECONDITION_FAILED",
  UPSTREAM_FAILED: "INTERNAL_SERVER_ERROR",
  CONFLICT: "CONFLICT",
};

export function apiError(code: ApiErrorCode, message: string, cause?: unknown): TRPCError {
  return new TRPCError({ code: TRPC_MAP[code], message, cause });
}
