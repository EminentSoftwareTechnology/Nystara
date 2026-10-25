import { Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text, render, toPlainText } from "@react-email/components";
import type { ExplicitTheme } from "../theme";

export const EMAIL_EVENTS = {
  "sign-in": { subject: "Your Nystara sign-in link", title: "Your next chapter starts here.", description: "Use this secure, one-time link to sign in to Nystara. It expires in 24 hours. If you didn’t request it, you can ignore this email.", label: "Sign in to Nystara", path: "/login", category: "essential", eyebrow: "YOUR SECURE SIGN-IN" },
  welcome: { subject: "Welcome to Nystara", title: "A home for your words.", description: "You’re part of Nystara. Finish setting up your account, discover writing worth your time, and make room for your own stories.", label: "Explore Nystara", path: "/", category: "activity", eyebrow: "WELCOME ABOARD" },
  "profile-updated": { subject: "Your Nystara profile was updated", title: "Your profile, refreshed.", description: "Your display name or bio has been updated. Visit your settings to review how you appear to readers.", label: "Review profile", path: "/settings", category: "essential", eyebrow: "ACCOUNT UPDATE" },
  "totp-enabled": { subject: "Authenticator enabled on Nystara", title: "Another layer of protection.", description: "An authenticator app was enabled for your account. Keep your recovery codes somewhere safe. We will never ask you to email them to us.", label: "Review security", path: "/me/security", category: "essential", eyebrow: "SECURITY UPDATE" },
  "totp-disabled": { subject: "Authenticator disabled on Nystara", title: "Your sign-in security changed.", description: "An authenticator app was disabled for your account. If this wasn’t you, contact support immediately and review your security settings.", label: "Review security", path: "/me/security", category: "essential", eyebrow: "SECURITY ALERT" },
  "passkey-added": { subject: "A passkey was added to Nystara", title: "A new key to your stories.", description: "A new passkey was added to your account. If you don’t recognise this change, review your security settings and contact support.", label: "Review passkeys", path: "/me/security", category: "essential", eyebrow: "SECURITY UPDATE" },
  "passkey-removed": { subject: "A passkey was removed from Nystara", title: "Your passkeys changed.", description: "A passkey was removed from your account. If you didn’t make this change, contact support immediately.", label: "Review passkeys", path: "/me/security", category: "essential", eyebrow: "SECURITY ALERT" },
  "recovery-regenerated": { subject: "Nystara recovery codes replaced", title: "New recovery codes. Fresh protection.", description: "New recovery codes were generated for your account. Your previous codes no longer work. Your new codes are shown only in your account, never in email.", label: "Review security", path: "/me/security", category: "essential", eyebrow: "SECURITY UPDATE" },
  "password-changed": { subject: "Your Nystara admin password changed", title: "Your password was changed.", description: "Your admin password was updated and previous admin sessions were invalidated. If this wasn’t you, contact support immediately.", label: "Sign in securely", path: "/admin/login", category: "essential", eyebrow: "SECURITY ALERT" },
  "role-changed": { subject: "Your Nystara account access changed", title: "Your account permissions changed.", description: "An administrator updated your account role. Contact support if you weren’t expecting this change.", label: "Contact support", path: "/contact", category: "essential", eyebrow: "ACCOUNT UPDATE" },
  "account-deleted": { subject: "Your Nystara account was deleted", title: "Your account has been removed.", description: "Your Nystara account and its associated content have been deleted. Any linked active subscription was cancelled. Contact support if you didn’t request this.", label: "Contact support", path: "/contact", category: "essential", eyebrow: "ACCOUNT CONFIRMATION" },
  "story-published": { subject: "Your story is live on Nystara", title: "Your words are out in the world.", description: "Your story is published and available to readers. Visit your stories to review it or share it with your audience.", label: "View your stories", path: "/me/stories", category: "activity", eyebrow: "PUBLISHED ON NYSTARA" },
  "story-unpublished": { subject: "Your Nystara story is now a draft", title: "A little more room to write.", description: "Your story has been unpublished. It is no longer available to readers. You can continue editing it from your stories.", label: "View your stories", path: "/me/stories", category: "activity", eyebrow: "STORY UPDATE" },
  "story-deleted": { subject: "A Nystara story was deleted", title: "Your story was removed.", description: "A story associated with your account was deleted. Visit your stories to review your remaining work or contact support with questions.", label: "View your stories", path: "/me/stories", category: "activity", eyebrow: "STORY UPDATE" },
  "comment-received": { subject: "A new response to your Nystara story", title: "Your story started a conversation.", description: "A reader left a comment on your story. Open Nystara to read the response and join the conversation.", label: "Read the response", path: "/me/stories", category: "activity", eyebrow: "FROM YOUR READERS" },
  "reply-received": { subject: "Someone replied to you on Nystara", title: "The conversation continues.", description: "Someone replied to your comment. Open Nystara to read their response.", label: "Read the reply", path: "/me/stories", category: "activity", eyebrow: "IN THE CONVERSATION" },
  "comment-removed": { subject: "Your Nystara comment was removed", title: "An update on your comment.", description: "The author of a story removed one of your comments. Contact support if you have questions about this change.", label: "Contact support", path: "/contact", category: "activity", eyebrow: "COMMENT UPDATE" },
} as const;

export type EmailEvent = keyof typeof EMAIL_EVENTS;
export const EMAIL_THEMES = ["light", "dark", "sand"] as const;
export const EMAIL_PALETTES = {
  light: { page: "#ffffff", card: "#f9fafb", text: "#000000", muted: "#4b5563", border: "#e6e8ec", accent: "#14224a", onAccent: "#ffffff", wall: "#efe2c4" },
  dark: { page: "#000000", card: "#121212", text: "#ffffff", muted: "#b5b5b5", border: "#2a2a2a", accent: "#ffffff", onAccent: "#000000", wall: "#2b261c" },
  sand: { page: "#f7f7f4", card: "#f1f0eb", text: "#26251e", muted: "#67665e", border: "#e6e5df", accent: "#26251e", onAccent: "#f7f7f4", wall: "#f0e3c4" },
} as const;

export type EmailOptions = { name?: string | null; theme?: ExplicitTheme; detail?: string; actionPath?: string; unsubscribeUrl?: string; actionUrl?: string };

export function appOrigin(): string {
  const url = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:6100");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid NEXTAUTH_URL");
  return url.origin;
}

export function appLink(path: string, origin = appOrigin()): string {
  const url = new URL(path, origin);
  if (url.origin !== origin || !["http:", "https:"].includes(url.protocol)) throw new Error("Email links must stay on the app origin");
  return url.href;
}

function EmailTemplate({ event, origin, ...options }: EmailOptions & { event: EmailEvent; origin: string }) {
  const content = EMAIL_EVENTS[event];
  const theme = options.theme ?? "light";
  const colors = EMAIL_PALETTES[theme];
  const action = options.actionUrl ? appLink(options.actionUrl, origin) : appLink(options.actionPath ?? content.path, origin);
  const linkStyle = { color: colors.muted, textDecoration: "underline" };
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content={theme === "dark" ? "dark" : "light"} />
        <meta name="supported-color-schemes" content={theme === "dark" ? "dark" : "light"} />
        <style>{`@media only screen and (max-width:600px){.email-shell{padding:12px 8px!important}.email-pad{padding:28px 20px!important}.email-title{font-size:32px!important;line-height:38px!important}}`}</style>
      </Head>
      <Preview>{content.subject}. {content.description}</Preview>
      <Body className="email-shell" style={{ margin: 0, padding: "32px 16px", backgroundColor: colors.page, color: colors.text, fontFamily: "Arial, Helvetica, sans-serif", fontSize: "16px", lineHeight: "26px" }}>
        <Container style={{ width: "100%", maxWidth: "720px", margin: "0 auto", backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: "24px", overflow: "hidden" }}>
          <Section className="email-pad" style={{ padding: "40px 48px", borderBottom: `1px solid ${colors.border}` }}>
            <Link href={origin} style={{ color: colors.text, textDecoration: "none" }}>
              <Img src={appLink(`/brand/email/${theme}.png`, origin)} width="48" height="48" alt="Nystara orbital logo" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "12px" }} />
              <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "32px", fontWeight: 600, verticalAlign: "middle" }}>Nystara</span>
            </Link>
            <Text style={{ margin: "20px 0 12px", color: colors.muted, fontSize: "11px", letterSpacing: "2px", fontWeight: 700 }}>{content.eyebrow}</Text>
            <Heading className="email-title" style={{ margin: "0", fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: "44px", lineHeight: "50px", letterSpacing: "-1px", color: colors.text }}>{content.title}</Heading>
            <Hr style={{ width: "64px", border: 0, borderTop: `4px solid ${colors.wall}`, margin: "24px 0 0" }} />
          </Section>
          <Section className="email-pad" style={{ padding: "36px 48px 44px", overflowWrap: "anywhere", wordBreak: "break-word" }}>
            <Text style={{ margin: "0 0 16px", fontSize: "16px", color: colors.text }}>Hello{options.name ? ` ${options.name}` : ""},</Text>
            <Text style={{ margin: "0 0 24px", fontSize: "16px", lineHeight: "26px", color: colors.text }}>{content.description}</Text>
            {options.detail && <Text style={{ padding: "20px", borderLeft: `3px solid ${colors.accent}`, borderRadius: "4px", backgroundColor: colors.page, color: colors.text, fontSize: "16px" }}>{options.detail}</Text>}
            <Button href={action} style={{ backgroundColor: colors.accent, color: colors.onAccent, borderRadius: "999px", padding: "15px 26px", fontSize: "16px", fontWeight: 600, textDecoration: "none" }}>{content.label}</Button>
            {event === "sign-in" && <Text style={{ fontSize: "12px", lineHeight: "20px", marginTop: "24px", color: colors.muted }}>Button not working? <Link href={action} style={linkStyle}>Open your secure sign-in link</Link>. Never forward this email or share your link.</Text>}
          </Section>
        </Container>
        <Container style={{ width: "100%", maxWidth: "720px", padding: "24px 20px", textAlign: "center" }}>
          <Text style={{ color: colors.muted, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "18px", margin: "0 0 12px" }}>Long-form writing that lasts.</Text>
          <Text style={{ fontSize: "12px", lineHeight: "24px", color: colors.muted, margin: "0 0 12px" }}>
            <Link href={appLink("/", origin)} style={linkStyle}>Read stories</Link>{" · "}<Link href={appLink("/contact", origin)} style={linkStyle}>Contact</Link>{" · "}<Link href={appLink("/privacy", origin)} style={linkStyle}>Privacy</Link>{" · "}<Link href={appLink("/terms", origin)} style={linkStyle}>Terms</Link>
          </Text>
          <Text style={{ fontSize: "12px", lineHeight: "20px", color: colors.muted, margin: "0 0 12px" }}>
            <Link href={appLink("/settings/notifications", origin)} style={linkStyle}>Email preferences</Link>
            {content.category === "activity" && options.unsubscribeUrl && <>{" · "}<Link href={appLink(options.unsubscribeUrl, origin)} style={linkStyle}>Unsubscribe from activity emails</Link></>}
          </Text>
          <Text style={{ fontSize: "12px", lineHeight: "20px", color: colors.muted, margin: 0 }}>{content.category === "essential" ? "This is an essential account or security message. You can unsubscribe from activity emails in email preferences." : "You’re receiving this because you have a Nystara account and activity emails are enabled."}</Text>
          <Text style={{ fontSize: "12px", color: colors.muted, margin: "12px 0 0" }}>© {new Date().getUTCFullYear()} Nystara. All rights reserved.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderEmail(event: EmailEvent, options: EmailOptions = {}) {
  const html = await render(<EmailTemplate event={event} origin={appOrigin()} {...options} />);
  return { subject: EMAIL_EVENTS[event].subject, html, text: toPlainText(html) };
}
