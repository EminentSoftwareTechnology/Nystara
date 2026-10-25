type Event =
  | "admin_login"
  | "password_change"
  | "role_change"
  | "account_erasure"
  | "data_export"
  | "passkey_login"
  | "mfa_verify"
  | "mfa_totp_enabled"
  | "mfa_totp_disabled"
  | "mfa_passkey_added"
  | "mfa_passkey_removed"
  | "mfa_recovery_regenerated";

export function audit(event: Event, outcome: "success" | "denied") {
  console.info(JSON.stringify({ event, outcome, timestamp: new Date().toISOString() }));
}
