export type SseEventName = "agent_token" | "agent_message" | "ticket_created" | "ticket_updated";

export interface SseEvent {
  id: string;
  name: SseEventName;
  data: unknown;
}

type Listener = (event: SseEvent) => void;

interface SessionChannel {
  nextId: number;
  buffer: SseEvent[];
  listeners: Set<Listener>;
}

const MAX_BUFFERED_EVENTS = 100;

const channels = new Map<string, SessionChannel>();

function getOrCreateChannel(sessionId: string): SessionChannel {
  let channel = channels.get(sessionId);
  if (!channel) {
    channel = { nextId: 1, buffer: [], listeners: new Set() };
    channels.set(sessionId, channel);
  }
  return channel;
}

export function publishEvent(sessionId: string, name: SseEventName, data: unknown): void {
  const channel = getOrCreateChannel(sessionId);
  const event: SseEvent = { id: String(channel.nextId), name, data };
  channel.nextId += 1;

  channel.buffer.push(event);
  if (channel.buffer.length > MAX_BUFFERED_EVENTS) {
    channel.buffer.shift();
  }

  for (const listener of channel.listeners) {
    listener(event);
  }
}

export function subscribe(sessionId: string, lastEventId: string | undefined, listener: Listener): () => void {
  const channel = getOrCreateChannel(sessionId);

  if (lastEventId !== undefined) {
    const lastId = Number(lastEventId);
    if (Number.isFinite(lastId)) {
      for (const event of channel.buffer) {
        if (Number(event.id) > lastId) {
          listener(event);
        }
      }
    }
  }

  channel.listeners.add(listener);
  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size === 0 && channel.buffer.length === 0) {
      channels.delete(sessionId);
    }
  };
}
