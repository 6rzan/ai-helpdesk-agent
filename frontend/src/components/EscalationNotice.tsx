interface EscalationNoticeProps {
  references: string[];
}

export function EscalationNotice({ references }: EscalationNoticeProps) {
  if (references.length === 0) {
    return null;
  }
  const plural = references.length > 1;
  return (
    <div
      role="status"
      className="mb-2 rounded border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-900"
    >
      IT staff are now involved with {plural ? "tickets" : "ticket"} {references.join(", ")} — updates
      will appear here in this chat.
    </div>
  );
}
