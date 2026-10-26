export function usesResend() {
  return process.env.NODE_ENV === "production" || process.env.EMAIL_PROVIDER !== "smtp";
}
