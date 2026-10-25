import {
  BookmarkIcon,
  ChartIcon,
  ClockIcon,
  DownloadIcon,
  type IconComponent,
  LockIcon,
  MailIcon,
  PaletteIcon,
  PenIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
} from "@/components/icons";

export type Feature = { Icon: IconComponent; title: string; body: string };

export const WRITER_FEATURES: Feature[] = [
  { Icon: PenIcon, title: "A calm place to write", body: "A clean, distraction-free editor. Draft in private, then publish when it’s ready." },
  { Icon: LockIcon, title: "Member-only stories", body: "Publish openly or mark a story member-only. Readers get five free every 30 days before the paywall." },
  { Icon: ChartIcon, title: "Stats that matter", body: "See views and reads for each story, so you know what resonates with your readers." },
  { Icon: UsersIcon, title: "Grow an audience", body: "Readers follow you and your new stories reach them. Your profile collects everything you’ve published." },
  { Icon: TagIcon, title: "Topics and tags", body: "Tag each story so the right readers find it alongside related writing." },
  { Icon: ClockIcon, title: "Read time, built in", body: "Every story shows an estimated read time, so readers know what they’re committing to." },
];

export const READER_FEATURES: Feature[] = [
  { Icon: BookmarkIcon, title: "Your library", body: "Save stories to read later and come back to the ones worth rereading." },
  { Icon: PaletteIcon, title: "Light, dark and sand", body: "Pick the theme that’s easiest on your eyes, or follow your system setting." },
  { Icon: MailIcon, title: "No password to remember", body: "Sign in with a one-time email link, Google or GitHub." },
  { Icon: ShieldIcon, title: "Protected from bots", body: "Sign-in is guarded by a privacy-friendly CAPTCHA and rate limits." },
  { Icon: DownloadIcon, title: "Your data, yours", body: "Export your account data as JSON at any time, and ask us to delete it." },
];
