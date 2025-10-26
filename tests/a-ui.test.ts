import { test, expect, beforeEach, afterEach, mock } from "bun:test";

beforeEach(() => {
  mock.restore();
});

afterEach(() => {
  mock.restore();
});

async function loadUi() {
  const mod = await import(new URL('../src/ui.ts', import.meta.url).href + '?t=' + Date.now());
  return { formatBytes: mod.formatBytes, formatDuration: mod.formatDuration };
}

test("formatBytes produces human-friendly sizes", async () => {
  const { formatBytes } = await loadUi();
  expect(formatBytes(10)).toBe("10 B");
  expect(formatBytes(1024)).toBe("1.0 KB");
  expect(formatBytes(1536)).toBe("1.5 KB");
});

test("formatDuration produces human-friendly durations", async () => {
  const { formatDuration } = await loadUi();
  expect(formatDuration(50)).toBe("50 ms");
  expect(formatDuration(1500)).toBe("1.5 s");
  expect(formatDuration(61000)).toBe("1m 1s");
});
