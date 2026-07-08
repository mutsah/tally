import { jsonInit, parseJson } from '@/lib/api/http';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  success: boolean;
  message: string;
}

/**
 * Change the signed-in user's password via the same-origin BFF proxy (which
 * forwards the session token to Nest). On a non-2xx, `parseJson` throws an
 * `ApiError` carrying the upstream status + Nest's message, so the caller can
 * map 401 (wrong current password) and 400 (weak / duplicate new password).
 */
export function changePassword(
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  return fetch('/api/auth/change-password', jsonInit('POST', input)).then(
    parseJson<ChangePasswordResult>,
  );
}
