// Demo data for local development: 50 readers/writers (user1@gmail.com … user50@gmail.com),
// 10 stories, tags, claps, comments, bookmarks and follows. Safe to re-run.
// Users sign in with the email magic link; in development it lands in the local SMTP catcher.
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { documentText, type StoryNode } from "../lib/story-document";
import { slugify } from "../lib/slug";

if (process.env.NODE_ENV === "production") {
  throw new Error("The demo seeder must not run in production");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const USER_COUNT = 50;

const FIRST_NAMES = [
  "Aarav", "Maya", "Liam", "Priya", "Noah", "Sofia", "Ethan", "Ananya", "Lucas", "Zara",
  "Mateo", "Isha", "Oliver", "Chloe", "Arjun", "Emma", "Leo", "Kavya", "Daniel", "Mia",
  "Rohan", "Grace", "Samuel", "Nina", "Kabir", "Ava", "Elijah", "Diya", "Henry", "Layla",
  "Vikram", "Ruby", "Jack", "Sara", "Aditya", "Hannah", "Owen", "Meera", "Theo", "Lily",
  "Nikhil", "Julia", "Ryan", "Tara", "Adam", "Elena", "Kiran", "Nora", "Sam", "Asha",
];
const LAST_NAMES = [
  "Sharma", "Chen", "Walker", "Reddy", "Garcia", "Patel", "Kim", "Nair", "Rossi", "Khan",
  "Silva", "Iyer", "Brown", "Martin", "Mehta", "Wilson", "Novak", "Rao", "Lee", "Lopez",
];
const BIOS = [
  "Engineer writing about AI tooling and developer workflow.",
  "Backend developer. Postgres, queues and the occasional rant.",
  "Product-minded engineer. I write what I wish I had read last year.",
  "Security curious. Patch early, patch often.",
  "Building agents by day, reading about them by night.",
];

type Story = {
  title: string;
  subtitle: string;
  publishedAt: string;
  memberOnly: boolean;
  tags: string[];
  clappers: number;
  comments: number;
  body: StoryNode[];
};

const text = (value: string): StoryNode => ({ type: "text", text: value });
const p = (value: string): StoryNode => ({ type: "paragraph", content: [text(value)] });
const h = (value: string): StoryNode => ({ type: "heading", attrs: { level: 2 }, content: [text(value)] });
const ul = (...items: string[]): StoryNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});
const ol = (...items: string[]): StoryNode => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});
const quote = (value: string): StoryNode => ({ type: "blockquote", content: [p(value)] });

// Titles and engagement levels mirror a real reading feed; the bodies are original demo copy.
const STORIES: Story[] = [
  {
    title: "AI Terms That Put You Ahead of 99% of People",
    subtitle: "A few more AI terms to know beyond tokens, prompts, and hallucinations.",
    publishedAt: "2026-10-15",
    memberOnly: false,
    tags: ["ai", "machine-learning"],
    clappers: 40,
    comments: 12,
    body: [
      p("Everyone knows tokens, prompts and hallucinations by now. The vocabulary that separates people who use AI from people who understand it is a little deeper."),
      h("Context window"),
      p("The amount of text a model can consider at once. Bigger windows let you hand over whole codebases or contracts, but more context is not free: it costs money, time and sometimes focus."),
      h("Embeddings"),
      p("A list of numbers that captures the meaning of a piece of text. Similar ideas land near each other, which is what makes semantic search and retrieval work."),
      h("Retrieval-augmented generation"),
      p("Instead of hoping the model remembers a fact, you look it up first and paste it into the prompt. Most useful company chatbots are this pattern underneath."),
      h("Temperature, evals and agents"),
      ul(
        "Temperature controls how adventurous the model is when picking the next token.",
        "Evals are repeatable tests that tell you whether a prompt change made things better or worse.",
        "Agents are models running in a loop with tools, deciding their own next step.",
      ),
      p("Learn these and the next product announcement will read like plain English."),
    ],
  },
  {
    title: "How To Run Claude Like a Tech Lead, Not a Senior Engineer",
    subtitle: "Briefing one session is the old skill. Running several in parallel is the new one.",
    publishedAt: "2026-09-01",
    memberOnly: true,
    tags: ["claude", "productivity", "programming"],
    clappers: 46,
    comments: 14,
    body: [
      p("A senior engineer writes great code. A tech lead makes sure four people write great code at the same time. The same shift is happening with AI coding assistants."),
      h("Split the work before you start"),
      p("Parallel sessions only help when the tasks do not step on each other. Break the feature into slices with clear boundaries: one session on the migration, one on the API, one on tests, one on docs."),
      h("Write briefs, not prompts"),
      ul(
        "State the goal and how you will verify it.",
        "Name the files that are in scope and the ones that are not.",
        "Say what done looks like: tests passing, a diff under a certain size, no new dependencies.",
      ),
      h("Review like a lead"),
      p("Your job moves from typing to reviewing. Read every diff, ask for smaller changes, and reject work that solves a problem nobody asked about."),
      quote("The leverage is not in the model. It is in how well you divide and check the work."),
    ],
  },
  {
    title: "Stop Using Claude Code Without Ponytail (It Beats Karpathy's Famous 4 Line CLAUDE.md)",
    subtitle: "A plugin that makes your coding agent justify every line before it writes it.",
    publishedAt: "2026-10-10",
    memberOnly: false,
    tags: ["claude", "programming", "ai"],
    clappers: 30,
    comments: 9,
    body: [
      p("Coding agents love to write code. That is the problem. Left alone, they add helpers, abstractions and defensive checks that nobody needs."),
      h("The idea"),
      p("Ponytail is a minimalism plugin. Before the agent writes anything, it walks a short decision ladder:"),
      ol(
        "Does this code need to exist at all?",
        "Does something in the codebase already do it?",
        "Can it be one line instead of ten?",
      ),
      h("Why short instruction files are not enough"),
      p("A four-line CLAUDE.md telling the model to keep it simple is a good start, but the model forgets intent under pressure. A structured checklist at the moment of writing holds up better."),
      h("Where to be careful"),
      p("Minimal is not the same as careless. Validation, security checks and error handling at real boundaries still belong in the code. Measure on your own repo before believing any benchmark."),
    ],
  },
  {
    title: "10 AI Tools Everyone Will Be Using in Six Months, But Almost Nobody's Found Yet",
    subtitle: "The toolkit you will see everywhere next year, and why it matters now.",
    publishedAt: "2026-09-30",
    memberOnly: true,
    tags: ["ai", "productivity"],
    clappers: 49,
    comments: 15,
    body: [
      p("Every few months a tool goes from niche to default. The pattern is predictable: power users adopt it, workflows form around it, then everyone else catches up."),
      h("What the next wave looks like"),
      ul(
        "Voice-first writing tools that turn rambling into structured drafts.",
        "Research notebooks that answer only from the sources you give them.",
        "Agents that operate your browser for repetitive admin work.",
        "Meeting tools that produce decisions and owners, not transcripts.",
        "Slide and doc generators that start from your own data.",
      ),
      h("How to spot them early"),
      p("Look for tools that remove a whole step rather than speed one up. If you stop opening another app because of it, it is probably going to stick."),
      p("Try one new tool a week, keep the ones you reach for without thinking, and drop the rest."),
    ],
  },
  {
    title: "8 Cool Things People Are Using Claude Opus 5.5 For",
    subtitle: "Project ideas to try with Claude Opus 5.5.",
    publishedAt: "2026-09-27",
    memberOnly: false,
    tags: ["claude", "ai"],
    clappers: 38,
    comments: 10,
    body: [
      p("New model releases are more interesting when you see what people build with them. Here are eight projects worth stealing."),
      ol(
        "Small browser games built from a single description.",
        "Interactive explainers for tricky concepts like recursion or compound interest.",
        "Personal finance dashboards from exported bank CSVs.",
        "Refactoring a legacy module with tests written first.",
        "Turning meeting notes into a tracked task list.",
        "Recipe planners that respect allergies and a budget.",
        "Landing pages for side projects in an afternoon.",
        "Study guides and quizzes from lecture slides.",
      ),
      h("The common thread"),
      p("Each project starts with a clear outcome and a way to check it. The model does the heavy lifting, but the person still decides what good looks like."),
    ],
  },
  {
    title: "5 Claude Tricks That Give You an Unfair Advantage (Most People Still Use the Old Way)",
    subtitle: "Habits taken from the official documentation, not recycled prompting tips.",
    publishedAt: "2026-08-07",
    memberOnly: true,
    tags: ["claude", "productivity"],
    clappers: 45,
    comments: 13,
    body: [
      p("Most prompting advice online is two model generations old. These habits still hold up."),
      ol(
        "Give context about why, not just what. The model makes better tradeoffs when it knows the goal.",
        "Use examples sparingly and make them varied, so the model does not copy one too literally.",
        "Ask for the format you want directly instead of describing what to avoid.",
        "Put long documents first and your question last.",
        "Let it think before answering hard problems, and ask it to check its own work.",
      ),
      h("Why this works"),
      p("Modern models follow instructions closely. Vague prompts get literal answers; clear prompts with a reason behind them get thoughtful ones."),
    ],
  },
  {
    title: "Think Php2Shell Was Bad? PHP Is About to Face an Anthropic Bloodbath",
    subtitle: "Lessons from decades of PHP, and what AI-assisted bug hunting means for old code.",
    publishedAt: "2026-10-22",
    memberOnly: false,
    tags: ["security", "php", "cybersecurity"],
    clappers: 32,
    comments: 12,
    body: [
      p("PHP runs a huge share of the web, much of it written years ago and rarely touched since. That code was safe mostly because nobody had time to read it carefully."),
      h("What changed"),
      p("AI models can now read large codebases and reason about how untrusted input flows through them. Finding bugs used to take weeks of expert attention. Now it can take an afternoon."),
      h("Who is exposed"),
      ul(
        "Sites on old PHP versions that no longer receive security fixes.",
        "Custom plugins and themes nobody has reviewed in years.",
        "Hosting where the PHP version is chosen by the provider, not the site owner.",
      ),
      h("What to do this week"),
      ol(
        "Upgrade to a supported PHP version.",
        "Remove plugins you do not use.",
        "Put a web application firewall in front of anything you cannot patch quickly.",
        "Subscribe to security advisories for your stack.",
      ),
      p("The same tools that find bugs can help fix them. Defenders who start now will be ahead."),
    ],
  },
  {
    title: "Agent Harness — A complete guide",
    subtitle: "Everything that wraps a model to turn it into a useful agent.",
    publishedAt: "2026-09-13",
    memberOnly: true,
    tags: ["agents", "ai", "programming"],
    clappers: 42,
    comments: 11,
    body: [
      p("A model on its own takes text in and gives text out. An agent reads files, runs commands and decides what to do next. The difference is the harness."),
      h("What a harness includes"),
      ul(
        "Tools: functions the model can call, like reading a file or querying a database.",
        "The loop: call the model, run the tools it asks for, feed back the results, repeat.",
        "Memory: what carries over between steps and between sessions.",
        "Guardrails: permissions, sandboxes and approval for risky actions.",
        "Context management: deciding what stays in the window when it fills up.",
      ),
      h("Why the harness matters as much as the model"),
      p("Two teams using the same model can get very different results. Clear tool descriptions, good error messages and sensible context trimming often matter more than switching models."),
      h("Start small"),
      p("Begin with two or three tools and a simple loop. Add pieces only when you see the agent fail without them."),
    ],
  },
  {
    title: "Anthropic Just Revealed 12 New Rules for Prompting Claude Opus 5.5",
    subtitle: "Developers need to rethink their prompts.",
    publishedAt: "2026-10-05",
    memberOnly: false,
    tags: ["claude", "prompt-engineering"],
    clappers: 35,
    comments: 8,
    body: [
      p("Each model generation follows instructions more precisely. Prompts written for older models often over-steer the new ones."),
      h("Themes worth knowing"),
      ul(
        "Be explicit about scope. If you want suggestions only, say so.",
        "Drop shouty capital letters. Newer models take emphasis seriously and may overreact.",
        "Explain the reason behind a rule so the model can apply it sensibly.",
        "Ask for the action you want instead of hinting at it.",
        "Tell it when to ask questions and when to proceed with sensible defaults.",
      ),
      h("A quick audit"),
      p("Open your longest system prompt and delete anything written to fix a problem the old model had. Then run your evals. You will often get better results with less."),
    ],
  },
  {
    title: "LangChain and LangGraph are DEAD? So what to USE!!",
    subtitle: "Why these frameworks took off, and what teams reach for now.",
    publishedAt: "2026-06-06",
    memberOnly: false,
    tags: ["langchain", "agents", "ai"],
    clappers: 36,
    comments: 14,
    body: [
      p("LangChain made it easy to chain model calls when every API was different. LangGraph added stateful, branching workflows on top. Both solved problems that were very real in 2023."),
      h("What changed"),
      p("Model APIs now support tool use, structured output and long context natively. A lot of the glue these frameworks provided is a few lines of plain code today."),
      h("Are they actually dead?"),
      p("No. Both are actively maintained, and LangGraph is still a solid choice for complex multi-step workflows with checkpoints. The question is whether you need them."),
      h("A simple rule"),
      ul(
        "One model, a handful of tools: use the provider SDK directly.",
        "Long-running workflows with branching and human approval: a graph framework earns its keep.",
        "Unsure: start without a framework and add one when the code starts asking for it.",
      ),
    ],
  },
];

const COMMENTS = [
  "This is exactly what I needed today. Thanks for writing it up.",
  "Saving this for my team's next retro.",
  "Great breakdown. The third point changed how I work.",
  "I tried this last week and it made a real difference.",
  "Would love a follow-up with more concrete examples.",
  "Not sure I agree with all of it, but the core idea holds.",
  "Clear and practical. More posts like this please.",
  "Shared this with two friends already.",
  "The section on review is underrated.",
  "Good read. Bookmarked.",
];
const REPLIES = [
  "Agreed, that part stood out to me too.",
  "Same experience here.",
  "Good point, I had not thought of it that way.",
];

// Deterministic so re-runs produce the same data.
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function main() {
  const random = rng(42);

  const users = [];
  for (let i = 1; i <= USER_COUNT; i++) {
    const name = `${FIRST_NAMES[i - 1]} ${LAST_NAMES[(i - 1) % LAST_NAMES.length]}`;
    const data = {
      name,
      username: `user${i}`,
      bio: BIOS[(i - 1) % BIOS.length],
      emailVerified: new Date("2026-01-01"),
    };
    users.push(
      await prisma.user.upsert({
        where: { email: `user${i}@gmail.com` },
        update: data,
        create: { email: `user${i}@gmail.com`, ...data },
      }),
    );
  }
  const userIds = users.map((u) => u.id);

  // Authors are user1 … user10. Recreating their demo stories resets claps, comments and bookmarks.
  const demoSlugs = STORIES.map((s) => slugify(s.title));
  await prisma.article.deleteMany({ where: { authorId: { in: userIds }, slug: { in: demoSlugs } } });

  for (const [index, story] of STORIES.entries()) {
    const author = users[index];
    const content: StoryNode = { type: "doc", content: story.body };
    const contentText = documentText(content);
    const wordCount = contentText.trim().split(/\s+/).filter(Boolean).length;
    const publishedAt = new Date(`${story.publishedAt}T09:00:00Z`);

    const article = await prisma.article.create({
      data: {
        slug: slugify(story.title),
        title: story.title,
        subtitle: story.subtitle,
        content: content as Prisma.InputJsonValue,
        contentText,
        readTime: Math.max(1, Math.ceil(wordCount / 200)),
        published: true,
        memberOnly: story.memberOnly,
        publishedAt,
        createdAt: publishedAt,
        authorId: author.id,
        tags: {
          create: story.tags.map((slug) => ({
            tag: { connectOrCreate: { where: { slug }, create: { slug, name: slug.replace(/-/g, " ") } } },
          })),
        },
      },
    });

    const readers = shuffled(userIds.filter((id) => id !== author.id), random);

    await prisma.clap.createMany({
      data: readers.slice(0, story.clappers).map((userId) => ({
        userId,
        articleId: article.id,
        count: 1 + Math.floor(random() * 50),
      })),
    });

    await prisma.bookmark.createMany({
      data: readers.slice(0, Math.ceil(story.clappers / 4)).map((userId) => ({ userId, articleId: article.id })),
    });

    for (let c = 0; c < story.comments; c++) {
      const created = new Date(publishedAt.getTime() + (c + 1) * 3_600_000);
      const comment = await prisma.comment.create({
        data: {
          body: COMMENTS[c % COMMENTS.length],
          authorId: readers[c],
          articleId: article.id,
          createdAt: created,
        },
      });
      if (c % 4 === 0) {
        await prisma.comment.create({
          data: {
            body: REPLIES[c % REPLIES.length],
            authorId: author.id,
            articleId: article.id,
            parentId: comment.id,
            createdAt: new Date(created.getTime() + 1_800_000),
          },
        });
      }
    }
  }

  // Everyone follows a few authors and a few other readers.
  const authorIds = userIds.slice(0, STORIES.length);
  const follows = users.flatMap((user) => {
    const targets = new Set([
      ...shuffled(authorIds, random).slice(0, 4),
      ...shuffled(userIds, random).slice(0, 3),
    ]);
    targets.delete(user.id);
    return [...targets].map((followingId) => ({ followerId: user.id, followingId }));
  });
  await prisma.follow.createMany({ data: follows, skipDuplicates: true });

  console.log(`Demo seeded: ${users.length} users, ${STORIES.length} stories, ${follows.length} follows`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
