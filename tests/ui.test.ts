import { test, expect } from "bun:test";

test("formatBytes produces human-friendly sizes", async () => {
  const { formatBytes } = (await import(new URL("../dist/ui.js", import.meta.url).href)) as any;
  expect(formatBytes(10)).toBe("10 B");
  expect(formatBytes(1024)).toBe("1.0 KB");
  expect(formatBytes(1536)).toBe("1.5 KB");
});

test("formatDuration produces human-friendly durations", async () => {
  const { formatDuration } = (await import(new URL("../dist/ui.js", import.meta.url).href)) as any;
  expect(formatDuration(50)).toBe("50 ms");
  expect(formatDuration(1500)).toBe("1.5 s");
  expect(formatDuration(61000)).toBe("1m 1s");
});
