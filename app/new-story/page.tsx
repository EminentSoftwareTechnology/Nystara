import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StoryEditor from "./StoryEditor";

export const dynamic = "force-dynamic";

export default async function NewStoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true, avatarUrl: true },
  });

  return (
    <StoryEditor
      name={dbUser?.name ?? session.user.name ?? null}
      email={session.user.email ?? null}
      avatarUrl={dbUser?.avatarUrl ?? session.user.image ?? null}
      username={dbUser?.username ?? null}
    />
  );
}
