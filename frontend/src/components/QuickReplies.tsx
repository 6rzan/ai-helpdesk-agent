interface QuickRepliesProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

const REPLIES = [
  { label: "That worked", text: "That worked" },
  { label: "Didn't work", text: "Didn't work" },
  { label: "Talk to a human", text: "I'd like to talk to a human" },
];

export function QuickReplies({ onSend, disabled = false }: QuickRepliesProps) {
  return (
    <div role="group" aria-label="Quick replies" className="flex flex-wrap gap-2 py-1">
      {REPLIES.map((reply) => (
        <button
          key={reply.label}
          type="button"
          disabled={disabled}
          onClick={() => onSend(reply.text)}
          className="rounded-full border border-blue-600 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 transition-transform duration-150 hover:bg-blue-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {reply.label}
        </button>
      ))}
    </div>
  );
}
