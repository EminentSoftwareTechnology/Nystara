/**
 * Environment Variable Validation
 *
 * Validates required environment variables at build/runtime.
 * Import this file early in your application to fail fast on missing config.
 */

const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
] as const;

const optionalEnvVars = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "ADMIN_JWT_SECRET",
  "MFA_ENCRYPTION_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "BLOB_READ_WRITE_TOKEN",
] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];
type OptionalEnvVar = (typeof optionalEnvVars)[number];
type EnvVar = RequiredEnvVar | OptionalEnvVar;

export function validateEnv(): void {
  const missing: RequiredEnvVar[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nSee .env.example for reference.`,
    );
  }

  // Warn about missing optional variables in production
  if (process.env.NODE_ENV === "production") {
    const missingOptional: OptionalEnvVar[] = [];

    for (const key of optionalEnvVars) {
      if (!process.env[key]) {
        missingOptional.push(key);
      }
    }

    if (missingOptional.length > 0) {
      warnings.push(
        `⚠️  Missing optional environment variables in production:\n${missingOptional.map((k) => `  - ${k}`).join("\n")}`,
      );
    }

    // Specific warnings for critical features
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GITHUB_CLIENT_ID ||
      !process.env.GITHUB_CLIENT_SECRET
    ) {
      warnings.push(
        "⚠️  OAuth providers not configured. Users won't be able to sign in with Google/GitHub.",
      );
    }

    if (!process.env.RESEND_API_KEY) {
      warnings.push(
        "⚠️  Resend not configured. Magic link emails won't be sent.",
      );
    }

    if (
      !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      !process.env.TURNSTILE_SECRET_KEY
    ) {
      warnings.push(
        "⚠️  Turnstile not configured. Bot protection disabled.",
      );
    }

    if (!process.env.MFA_ENCRYPTION_KEY) {
      warnings.push(
        "⚠️  MFA_ENCRYPTION_KEY not set. Authenticator-app setup and sign-in will fail.",
      );
    }

    if (!process.env.ADMIN_JWT_SECRET) {
      warnings.push(
        "⚠️  ADMIN_JWT_SECRET not set. Admin panel authentication may be insecure.",
      );
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn("\n" + warnings.join("\n\n") + "\n");
  }
}

/**
 * Get an environment variable with type safety.
 * Throws if the variable is not set.
 */
export function getEnv(key: EnvVar): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get an optional environment variable.
 * Returns undefined if not set.
 */
export function getOptionalEnv(key: EnvVar): string | undefined {
  return process.env[key];
}

/**
 * Check if we're in development mode.
 */
export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if we're in production mode.
 */
export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if we're in test mode.
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

// Validate on import (fail fast)
if (!isTest()) {
  validateEnv();
}
