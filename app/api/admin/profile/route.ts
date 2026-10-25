import { notifyUser } from "@/lib/email/notifications";
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/password";
import { clearAdminSessionCookie } from "@/lib/admin-session";
import { isOwnedProfileImage } from "@/lib/storage-url";
import { readJson } from "@/lib/request";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().min(1).max(2048).nullable().optional(),
  currentPassword: z.string().max(256).optional(),
  newPassword: passwordSchema.optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, bio, avatarUrl, currentPassword, newPassword } = parsed.data;

  if (avatarUrl && !isOwnedProfileImage(avatarUrl, session.sub)) return NextResponse.json({ error: "Upload your own profile photo first." }, { status: 400 });

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id: session.sub },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } } : {}),
    },
    select: { id: true, email: true, name: true, bio: true, avatarUrl: true },
  });

  if (newPassword) {
    await clearAdminSessionCookie();
    audit("password_change", "success");
    await notifyUser(user.id, "password-changed");
  }
  if (name !== undefined || bio !== undefined || avatarUrl !== undefined) await notifyUser(user.id, "profile-updated");
  return NextResponse.json(user);
}
