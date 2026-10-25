import { safeLink, type StoryNode } from "./story-document";

type Mark = NonNullable<StoryNode["marks"]>[number];

const INLINE =
  /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/;

function inline(text: string, marks: Mark[] = []): StoryNode[] {
  const nodes: StoryNode[] = [];
  let rest = text;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(textNode(rest, marks));
      break;
    }
    if (match.index > 0) nodes.push(textNode(rest.slice(0, match.index), marks));
    const [, , bold1, bold2, italic1, italic2, code, label, href] = match;
    if (bold1 ?? bold2) nodes.push(...inline(bold1 ?? bold2, [...marks, { type: "bold" }]));
    else if (italic1 ?? italic2)
      nodes.push(...inline(italic1 ?? italic2, [...marks, { type: "italic" }]));
    else if (code) nodes.push(textNode(code, [...marks, { type: "code" }]));
    else if (label)
      nodes.push(
        ...inline(
          label,
          safeLink(href) ? [...marks, { type: "link", attrs: { href } }] : marks,
        ),
      );
    rest = rest.slice(match.index + match[0].length);
  }
  return nodes;
}

function textNode(text: string, marks: Mark[]): StoryNode {
  return marks.length ? { type: "text", text, marks } : { type: "text", text };
}

function paragraph(text: string): StoryNode {
  return { type: "paragraph", content: inline(text) };
}

/** Converts common Markdown into the editor's document structure. */
export function markdownDocument(markdown: string): StoryNode {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const content: StoryNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      content.push({
        type: "codeBlock",
        content: code.length ? [{ type: "text", text: code.join("\n") }] : [],
      });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: Math.min(heading[1].length, 3) },
        content: inline(heading[2].trim()),
      });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }
    const list = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const pattern = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      const items: StoryNode[] = [];
      let item: RegExpExecArray | null;
      while (i < lines.length && (item = pattern.exec(lines[i]))) {
        items.push({ type: "listItem", content: [paragraph(item[1])] });
        i++;
      }
      content.push({ type: ordered ? "orderedList" : "bulletList", content: items });
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">"))
        quote.push(lines[i++].replace(/^>\s?/, ""));
      content.push({
        type: "blockquote",
        content: quote
          .join("\n")
          .split(/\n\s*\n/)
          .map((part) => paragraph(part.replace(/\n/g, " "))),
      });
      continue;
    }
    const text: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])
    )
      text.push(lines[i++].trim());
    content.push(paragraph(text.join(" ")));
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph", content: [] }] };
}
