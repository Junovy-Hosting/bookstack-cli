import { test, expect } from "bun:test";
import { createProgressBar, configureUi } from "../src/ui";

// Tests for the progress bar's pinned output behavior.
// The log() method clears the bar, prints a message, then redraws the bar,
// keeping the progress bar pinned at the bottom while messages scroll above.
//
// Save references at import time so mock.module() in other test files
// (cli-list, cli-show) cannot replace our bindings.
const realConfigureUi = configureUi;
const realCreateProgressBar = createProgressBar;

let stderrChunks: string[];
let origWrite: typeof process.stderr.write;

function captureStderr() {
  stderrChunks = [];
  origWrite = process.stderr.write;
  process.stderr.write = ((chunk: any) => {
    stderrChunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  }) as any;
}

function restoreStderr() {
  process.stderr.write = origWrite;
}

test("progress bar log() clears bar line, prints message, then redraws bar", () => {
  realConfigureUi({ color: false, quiet: false });
  captureStderr();
  try {
    const bar = realCreateProgressBar(10, 'Test');
    stderrChunks = []; // clear initial draw

    bar.log('Processing item A');

    const output = stderrChunks.join('');
    expect(output).toContain('Processing item A\n');
    // Bar should be redrawn after the message (contains 0/10)
    const msgIndex = output.indexOf('Processing item A\n');
    const barAfter = output.slice(msgIndex + 'Processing item A\n'.length);
    expect(barAfter).toContain('0/10');
  } finally {
    restoreStderr();
  }
});

test("progress bar log() works correctly after tick", () => {
  realConfigureUi({ color: false, quiet: false });
  captureStderr();
  try {
    const bar = realCreateProgressBar(5, 'Import');
    bar.tick();
    stderrChunks = []; // clear initial draws

    bar.log('Created page: Foo');

    const output = stderrChunks.join('');
    expect(output).toContain('Created page: Foo\n');
    const msgIndex = output.indexOf('Created page: Foo\n');
    const barAfter = output.slice(msgIndex + 'Created page: Foo\n'.length);
    expect(barAfter).toContain('1/5');
  } finally {
    restoreStderr();
  }
});

test("progress bar log() supports multiple messages in sequence", () => {
  realConfigureUi({ color: false, quiet: false });
  captureStderr();
  try {
    const bar = realCreateProgressBar(3, 'Import');
    stderrChunks = [];

    bar.log('Message 1');
    bar.tick();
    bar.log('Message 2');

    const output = stderrChunks.join('');
    const idx1 = output.indexOf('Message 1\n');
    const idx2 = output.indexOf('Message 2\n');
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThan(idx1);
  } finally {
    restoreStderr();
  }
});
