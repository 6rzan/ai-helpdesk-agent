import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom has no EventSource; provide an inert stub so components using SSE hooks
// (useEvents / useStaffEvents) render without touching the network.
class MockEventSource {
  constructor(public url: string) {}
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

if (!("EventSource" in globalThis)) {
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
}
