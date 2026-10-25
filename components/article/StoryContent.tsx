import type { CSSProperties, ReactNode } from "react";
import { storyNode, safeLink, legacyDocument, type StoryNode } from "@/lib/story-document";
import { isStorageImage } from "@/lib/storage-url";
import VideoPreview from "./VideoPreview";
import { parseVideoUrl } from "@/lib/video";

function renderNode(node: StoryNode, key: number): ReactNode {
  const children = node.content?.map(renderNode);
  const style: CSSProperties = {
    textAlign: node.attrs?.textAlign ?? undefined,
  };
  switch (node.type) {
    case "text": {
      let text: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case "bold":
            text = <strong>{text}</strong>;
            break;
          case "italic":
            text = <em>{text}</em>;
            break;
          case "underline":
            text = <u>{text}</u>;
            break;
          case "strike":
            text = <s>{text}</s>;
            break;
          case "code":
            text = <code>{text}</code>;
            break;
          case "link":
            if (mark.attrs?.href && safeLink(mark.attrs.href))
              text = (
                <a href={mark.attrs.href} rel="noopener noreferrer">
                  {text}
                </a>
              );
            break;
          case "textStyle":
            text = (
              <span
                style={{
                  fontFamily: mark.attrs?.fontFamily ?? undefined,
                  fontSize: mark.attrs?.fontSize ?? undefined,
                  lineHeight: mark.attrs?.lineHeight ?? undefined,
                }}
              >
                {text}
              </span>
            );
            break;
        }
      }
      return <span key={key}>{text}</span>;
    }
    case "doc":
      return <div key={key}>{children}</div>;
    case "paragraph": {
      const parts = node.content ?? [];
      const onlyText = parts.every((part) => part.type === "text");
      const raw = onlyText ? parts.map((part) => part.text ?? "").join("").trim() : "";
      const linkedUrl = parts.length === 1 && parts[0].type === "text"
        ? parts[0].marks?.find((mark) => mark.type === "link")?.attrs?.href
        : undefined;
      const inlineCode = parts.some((part) => part.marks?.some((mark) => mark.type === "code"));
      const video = inlineCode ? null : parseVideoUrl(raw) ?? (linkedUrl ? parseVideoUrl(linkedUrl) : null);
      if (video) return <VideoPreview key={key} url={video.url} title={linkedUrl && raw !== linkedUrl ? raw : undefined} />;
      if (onlyText && !parts.some((part) => part.marks?.length) && raw.includes("\n") && raw.split("\n").some((line) => parseVideoUrl(line.trim()))) {
        return <div key={key}>{raw.split("\n").map((line, index) => renderNode({ type: "paragraph", content: [{ type: "text", text: line }] }, index))}</div>;
      }
      return (
        <p key={key} style={style}>
          {children?.length ? children : <br />}
        </p>
      );
    }
    case "heading":
      return node.attrs?.level === 1 ? (
        <h1 key={key} style={style}>
          {children}
        </h1>
      ) : node.attrs?.level === 3 ? (
        <h3 key={key} style={style}>
          {children}
        </h3>
      ) : (
        <h2 key={key} style={style}>
          {children}
        </h2>
      );
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={node.attrs?.start}>
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "image":
      return node.attrs?.src && isStorageImage(node.attrs.src) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : null;
    case "video":
      return node.attrs?.url ? (
        <VideoPreview
          key={key}
          url={node.attrs.url}
          title={node.attrs.title}
          thumbnail={node.attrs.thumbnail}
        />
      ) : null;
  }
}

export default function StoryContent({
  content,
  text,
}: {
  content: unknown;
  text: string;
}) {
  const result = storyNode.safeParse(content);
  return (
    <div className="story-prose">
      {result.success && result.data.type === "doc" && result.data.content ? (
        renderNode(result.data, 0)
      ) : (
        renderNode(legacyDocument(text), 0)
      )}
    </div>
  );
}
