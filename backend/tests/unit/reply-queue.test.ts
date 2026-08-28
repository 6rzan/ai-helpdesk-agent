import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { enqueueReply, pendingConversationCount } from "../../src/services/conversation/reply-queue.js";

// T083 (OBS-14): the per-conversation reply queue, extracted from
// conversation-engine.ts. Two reports arriving back to back on one
// conversation must run one after the other — the race this fixes produced
// agent replies quoting ticket references that never persisted.

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (err: Error) => void } {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets every already-settled microtask run before the assertions read state. */
async function drain(): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    await Promise.resolve();
  }
}

describe("enqueueReply", () => {
  it("TC: serializes two replies on the same conversation instead of overlapping them", async () => {
    const conversationId = new Types.ObjectId();
    const order: string[] = [];
    const first = deferred();

    enqueueReply(conversationId, async () => {
      order.push("first:start");
      await first.promise;
      order.push("first:end");
    });
    enqueueReply(conversationId, async () => {
      order.push("second:start");
    });

    await drain();
    // The second turn must not have started while the first is still running.
    expect(order).toEqual(["first:start"]);

    first.resolve();
    await drain();

    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("TC: does not serialize replies belonging to different conversations", async () => {
    const conversationA = new Types.ObjectId();
    const conversationB = new Types.ObjectId();
    const order: string[] = [];
    const blocker = deferred();

    enqueueReply(conversationA, async () => {
      order.push("a:start");
      await blocker.promise;
      order.push("a:end");
    });
    enqueueReply(conversationB, async () => {
      order.push("b:start");
    });

    await drain();
    // B is independent of A, so it runs while A is still blocked.
    expect(order).toEqual(["a:start", "b:start"]);

    blocker.resolve();
    await drain();
    expect(order).toContain("a:end");
  });

  it("TC: a failing turn is contained — the next turn on that conversation still runs", async () => {
    const conversationId = new Types.ObjectId();
    const order: string[] = [];

    enqueueReply(conversationId, async () => {
      order.push("failing");
      throw new Error("processReply blew up");
    });
    enqueueReply(conversationId, async () => {
      order.push("recovered");
    });

    await drain();

    expect(order).toEqual(["failing", "recovered"]);
  });

  it("TC: releases the conversation's queue slot once the queue drains (OBS-15)", async () => {
    const conversationId = new Types.ObjectId();
    const before = pendingConversationCount();

    enqueueReply(conversationId, async () => {
      // resolves immediately
    });

    await drain();

    expect(pendingConversationCount()).toBe(before);
  });
});
