import { prisma } from "@/lib/prisma";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniqueSlug(
  title: string,
  authorId: string,
): Promise<string> {
  const base = slugify(title) || "untitled";

  const existing = await prisma.article.findMany({
    where: { authorId, slug: { startsWith: base } },
    select: { slug: true },
  });

  if (!existing.some((a) => a.slug === base)) return base;

  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffixes = existing
    .map((a) => {
      const match = a.slug.match(new RegExp(`^${escapedBase}-(\\d+)$`));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(Boolean);

  const next = suffixes.length > 0 ? Math.max(...suffixes) + 1 : 2;
  return `${base}-${next}`;
}
