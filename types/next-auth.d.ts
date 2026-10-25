import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** The user has MFA on and this session hasn't completed it yet. */
      mfaPending: boolean;
    } & DefaultSession["user"];
  }
}
