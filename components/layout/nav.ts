import {
  BookmarkIcon,
  ChartIcon,
  HelpIcon,
  HomeIcon,
  type IconComponent,
  PenIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  WandIcon,
  BookIcon,
} from "@/components/icons";

export type NavItem = { href: string; label: string; Icon: IconComponent };
export type NavSection = { title: string; items: NavItem[] };

export type NavUser = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
};

/** Every signed-in destination, grouped the same way in the desktop sidebar and the mobile "More" sheet. */
export function navSections(username: string | null): NavSection[] {
  return [
    {
      title: "Read",
      items: [
        { href: "/", label: "Home", Icon: HomeIcon },
        { href: "/me/library", label: "Library", Icon: BookmarkIcon },
        { href: "/me/following", label: "Following", Icon: UsersIcon },
        { href: "/me/following/suggestions", label: "Find writers", Icon: UserPlusIcon },
      ],
    },
    {
      title: "Write",
      items: [
        { href: "/new-story", label: "Write", Icon: PenIcon },
        { href: "/ai-editor", label: "AI editor", Icon: WandIcon },
        { href: "/me/stories", label: "Stories", Icon: BookIcon },
        { href: "/me/stats", label: "Stats", Icon: ChartIcon },
        { href: "/me/audience", label: "Audience", Icon: UsersIcon },
      ],
    },
    {
      title: "Account",
      items: [
        { href: username ? `/${username}` : "/settings", label: "Profile", Icon: UserIcon },
        { href: "/settings", label: "Settings", Icon: SettingsIcon },
        { href: "/me/security", label: "Security", Icon: ShieldIcon },
        { href: "/me/help", label: "Help", Icon: HelpIcon },
      ],
    },
  ];
}

/** The most specific item wins, so /me/following/suggestions doesn't also light up /me/following. */
export function activeHref(pathname: string, sections: NavSection[]): string | null {
  let best: string | null = null;
  for (const { href } of sections.flatMap((s) => s.items)) {
    const match = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    if (match && (!best || href.length > best.length)) best = href;
  }
  return best;
}
