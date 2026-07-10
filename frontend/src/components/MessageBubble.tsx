import type { MessageAuthor } from "../lib/types";

interface MessageBubbleProps {
  author: MessageAuthor;
  text: string;
  isStreaming?: boolean;
}

const AUTHOR_STYLES: Record<MessageAuthor, string> = {
  user: "self-end bg-blue-600 text-white",
  agent: "self-start bg-gray-100 text-gray-900",
  system: "self-center bg-amber-50 text-amber-900 border border-amber-200",
};

export function MessageBubble({ author, text, isStreaming = false }: MessageBubbleProps) {
  return (
    <div
      className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${AUTHOR_STYLES[author]}`}
    >
      {text}
      {isStreaming && <span className="ml-0.5 animate-pulse">▍</span>}
    </div>
  );
}
