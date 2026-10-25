import { createHmac } from "node:crypto";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPaywallAccess, extractExcerpt } from "@/lib/paywall";
import { getClientIp } from "@/lib/client-ip";

// Quota is per-device. The keyed hash keeps raw IPs out of the DB and can't be
// reversed by enumerating the IPv4 space without the server secret.
async function deriveVisitorId(): Promise<string> {
  const hdrs = await headers();
  const ua = hdrs.get("user-agent") ?? "";
  const digest = createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(`${getClientIp(hdrs)}|${ua}`)
    .digest("hex");
  return `anon-${digest.slice(0, 32)}`;
}

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

export default async function ArticlePage({ params }: Props) {
  const { username, slug } = await params;

  const author = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!author) notFound();

  const article = await prisma.article.findUnique({
    where: { authorId_slug: { authorId: author.id, slug } },
    select: {
      id: true,
      title: true,
      subtitle: true,
      coverImage: true,
      contentText: true,
      readTime: true,
      memberOnly: true,
      published: true,
      publishedAt: true,
      author: { select: { username: true, name: true, avatarUrl: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      _count: { select: { claps: true, comments: true } },
    },
  });

  if (!article || !article.published) notFound();

  let paywalled = false;

  if (article.memberOnly) {
    const session = await auth();

    if (session?.user?.id) {
      const sub = await prisma.subscription.findUnique({
        where: { userId: session.user.id },
        select: { status: true },
      });
      if (sub?.status === "ACTIVE") {
        paywalled = false;
      } else {
        // Logged-in non-members get the same free quota as anonymous visitors
        const visitorId = session.user.id;
        const { allowed } = await checkPaywallAccess(visitorId, article.id);
        paywalled = !allowed;
      }
    } else {
      const visitorId = await deriveVisitorId();
      const { allowed } = await checkPaywallAccess(visitorId, article.id);
      paywalled = !allowed;
    }
  }

  const displayText = paywalled
    ? extractExcerpt(article.contentText)
    : article.contentText;

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      {article.coverImage && (
        // Cover images come from arbitrary user-supplied URLs; remotePatterns handles known hosts
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.coverImage}
          alt={article.title}
          className="w-full rounded-lg mb-8 object-cover max-h-96"
        />
      )}

      <h1 className="text-4xl font-bold leading-tight mb-3">{article.title}</h1>
      {article.subtitle && (
        <p className="text-xl text-gray-600 mb-4">{article.subtitle}</p>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link
          href={`/${article.author.username}`}
          className="font-medium text-gray-900 hover:underline"
        >
          {article.author.name ?? article.author.username}
        </Link>
        <span>·</span>
        <span>{article.readTime} min read</span>
        {article.publishedAt && (
          <>
            <span>·</span>
            <span>
              {new Date(article.publishedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </>
        )}
        {article.memberOnly && (
          <span className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Member
          </span>
        )}
      </div>

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {article.tags.map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/tag/${tag.slug}`}
              className="text-sm text-gray-600 hover:underline"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}

      <div className="prose max-w-none">
        <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>
      </div>

      {paywalled && (
        <div className="mt-10 py-10 border-t text-center">
          <h2 className="text-2xl font-bold mb-2">
            This story is for members only
          </h2>
          <p className="text-gray-600 mb-6">
            Become a member to read the full story and support the author.
          </p>
          <Link
            href="/subscribe"
            className="inline-block px-8 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800"
          >
            Become a member
          </Link>
        </div>
      )}

      <div className="mt-8 pt-6 border-t flex items-center gap-4 text-sm text-gray-500">
        <span>{article._count.claps} claps</span>
        <span>{article._count.comments} comments</span>
      </div>
    </main>
  );
}
