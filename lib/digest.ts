import type { DigestFrequency } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { trendingArticles } from "./engagement";
import { deliverEmail } from "./email/send";
import { usesResend } from "./email/provider";
import { appLink, renderEmail, type DigestSection } from "./email/templates";
import { prisma } from "./prisma";
import { isExplicitTheme } from "./theme";

export const DIGEST_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;

const DAY = 86400_000;
const PERIOD: Record<DigestFrequency, number> = { DAILY: DAY, WEEKLY: 7 * DAY, MONTHLY: 30 * DAY };
// Slightly shorter than the period, so a scheduler that runs a few minutes early still sends.
const RESEND_AFTER: Record<DigestFrequency, number> = { DAILY: 20 * 3600_000, WEEKLY: 6.5 * DAY, MONTHLY: 27 * DAY };
const EVENT = { DAILY: "digest-daily", WEEKLY: "digest-weekly", MONTHLY: "digest-monthly" } as const;

type TokenPurpose = "digest-confirm" | "digest-unsubscribe";

function key() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for digest links");
  return new TextEncoder().encode(secret);
}

export async function digestToken(purpose: TokenPurpose, subscriberId: string, frequency?: DigestFrequency) {
  return new SignJWT({ purpose, ...(frequency ? { frequency } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subscriberId)
    .setAudience("nystara:digest")
    .setIssuedAt()
    .setExpirationTime(purpose === "digest-confirm" ? "7d" : "365d")
    .sign(key());
}

export async function readDigestToken(purpose: TokenPurpose, token: string) {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], audience: "nystara:digest" });
    if (payload.purpose !== purpose || typeof payload.sub !== "string" || !payload.sub) return null;
    const frequency = DIGEST_FREQUENCIES.find((value) => value === payload.frequency);
    return { subscriberId: payload.sub, frequency };
  } catch {
    return null;
  }
}

/** Always sends a confirmation, so the response never reveals whether an address is already subscribed. */
export async function requestSubscription(email: string, frequency: DigestFrequency) {
  const subscriber = await prisma.subscriber.upsert({
    where: { email },
    create: { email, frequency },
    update: {},
    select: { id: true, userId: true },
  });
  const user = subscriber.userId ? await prisma.user.findUnique({ where: { id: subscriber.userId }, select: { emailTheme: true } }) : null;
  const token = await digestToken("digest-confirm", subscriber.id, frequency);
  const message = await renderEmail("digest-confirm", {
    actionPath: `/newsletter/confirm?token=${encodeURIComponent(token)}`,
    theme: isExplicitTheme(user?.emailTheme) ? user.emailTheme : "light",
  });
  await deliverEmail(email, message);
}

/** Signed-in members already proved their address, so their choice applies immediately. */
export async function setMemberDigest(userId: string, frequency: DigestFrequency | null) {
  if (!frequency) {
    await prisma.subscriber.deleteMany({ where: { userId } });
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  // Replaces any visitor signup for the same address, so one inbox has one digest.
  await prisma.$transaction([
    prisma.subscriber.deleteMany({ where: { OR: [{ userId }, { email: user.email }] } }),
    prisma.subscriber.create({ data: { email: user.email, userId, frequency, confirmedAt: new Date() } }),
  ]);
}

function readsLabel(count: number) {
  return `${count.toLocaleString("en")} read${count === 1 ? "" : "s"}`;
}

/** New, most-read and trending stories for one period. Empty when nothing happened. */
export async function digestSections(frequency: DigestFrequency, now = new Date()): Promise<DigestSection[]> {
  const since = new Date(now.getTime() - PERIOD[frequency]);
  const visible = { published: true, unlisted: false, author: { username: { not: null } } } as const;
  const [fresh, views, trending] = await Promise.all([
    prisma.article.findMany({
      where: { ...visible, publishedAt: { gte: since, lte: now } },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { slug: true, title: true, readTime: true, author: { select: { name: true, username: true } } },
    }),
    prisma.articleView.groupBy({
      by: ["articleId"],
      where: { createdAt: { gte: since, lte: now } },
      _count: { articleId: true },
      orderBy: { _count: { articleId: "desc" } },
      take: 10,
    }),
    trendingArticles(5),
  ]);
  const viewed = await prisma.article.findMany({
    where: { ...visible, id: { in: views.map((row) => row.articleId) } },
    select: { id: true, slug: true, title: true, author: { select: { username: true } } },
  });
  const byId = new Map(viewed.map((article) => [article.id, article]));
  const mostRead = views.flatMap((row) => {
    const article = byId.get(row.articleId);
    return article ? [{ title: article.title, path: `/${article.author.username}/${article.slug}`, meta: `@${article.author.username} · ${readsLabel(row._count.articleId)}` }] : [];
  }).slice(0, 5);
  const sections: DigestSection[] = [
    { heading: "Newly published", items: fresh.map((article) => ({ title: article.title, path: `/${article.author.username}/${article.slug}`, meta: `${article.author.name ?? `@${article.author.username}`} · ${article.readTime} min read` })) },
    { heading: "Most read", items: mostRead },
    { heading: "Trending now", items: trending.map((article) => ({ title: article.title, path: `/${article.username}/${article.slug}`, meta: `@${article.username}${article.topic ? ` · ${article.topic}` : ""}` })) },
  ];
  return sections.filter((section) => section.items.length > 0);
}

export function isDigestDue(frequency: DigestFrequency, lastSentAt: Date | null, now = new Date()) {
  return !lastSentAt || now.getTime() - lastSentAt.getTime() >= RESEND_AFTER[frequency];
}

/** Sends every due digest. Safe to run as often as hourly: lastSentAt prevents repeats. */
export async function sendDueDigests(now = new Date()) {
  const stats = { sent: 0, failed: 0, skipped: 0 };
  for (const frequency of DIGEST_FREQUENCIES) {
    const sections = await digestSections(frequency, now);
    const due = (await prisma.subscriber.findMany({
      where: { frequency, confirmedAt: { not: null } },
      select: { id: true, email: true, lastSentAt: true, user: { select: { name: true, emailTheme: true } } },
    })).filter((subscriber) => isDigestDue(frequency, subscriber.lastSentAt, now));
    if (!sections.length) {
      stats.skipped += due.length;
      continue;
    }
    for (const subscriber of due) {
      try {
        const unsubscribeUrl = appLink(`/newsletter/unsubscribe?token=${encodeURIComponent(await digestToken("digest-unsubscribe", subscriber.id))}`);
        const message = await renderEmail(EVENT[frequency], {
          name: subscriber.user?.name,
          theme: isExplicitTheme(subscriber.user?.emailTheme) ? subscriber.user.emailTheme : "light",
          sections,
          unsubscribeUrl,
        });
        await deliverEmail(subscriber.email, message, unsubscribeUrl);
        await prisma.subscriber.update({ where: { id: subscriber.id }, data: { lastSentAt: now } });
        stats.sent++;
      } catch {
        stats.failed++;
      }
      // Resend's default limit is a few requests per second.
      if (usesResend()) await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return stats;
}
