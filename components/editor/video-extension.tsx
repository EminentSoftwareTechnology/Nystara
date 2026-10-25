"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import VideoPreview from "@/components/article/VideoPreview";

function VideoNodeView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper>
      <VideoPreview
        url={String(node.attrs.url ?? "")}
        title={String(node.attrs.title ?? "Video")}
        thumbnail={String(node.attrs.thumbnail ?? "")}
      />
    </NodeViewWrapper>
  );
}

export const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "Video" },
      thumbnail: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-video]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-video": "true" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});
