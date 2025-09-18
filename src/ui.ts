// Minimal UI helpers for colors, spinners, and progress bars
import pc from 'picocolors';

let colorEnabled = true;
let quietEnabled = false;

export function configureUi(opts: { color?: boolean; quiet?: boolean }) {
  if (typeof opts.color === 'boolean') colorEnabled = opts.color;
  if (typeof opts.quiet === 'boolean') {
    quietEnabled = opts.quiet;
    if (quietEnabled) {
      (console as any)._origLog = (console as any)._origLog || console.log;
      console.log = (() => {}) as any;
    } else if ((console as any)._origLog) {
      console.log = (console as any)._origLog;
    }
  }
}

export const c: any = new Proxy(pc as any, {
  get(target, prop: any) {
    const fn = (target as any)[prop];
    if (typeof fn !== 'function') return fn;
    return (s: any) => (colorEnabled ? fn(String(s)) : String(s));
  }
});

export function createSpinner(text: string) {
  let active = false;
  let frame = 0;
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let timer: NodeJS.Timeout | undefined;
  const write = (msg: string) => process.stderr.write(`\r${msg}`);
  const clear = () => process.stderr.write('\r\x1b[2K');
  function render(prefix: string, txt: string) {
    write(`${prefix} ${txt}`);
  }
  if (quietEnabled) {
    return {
      start() { return this; },
      update() { return this; },
      succeed() { return this; },
      fail() { return this; },
      stop() {}
    } as any;
  }
  return {
    start(msg = text) {
      active = true;
      text = msg;
      timer = setInterval(() => {
        const f = frames[frame = (frame + 1) % frames.length];
        render(c.blue(f), text);
      }, 80);
      return this;
    },
    update(msg: string) {
      text = msg;
      return this;
    },
    succeed(msg?: string) {
      if (!active) return this;
      if (timer) clearInterval(timer);
      clear();
      render(c.green('✔'), msg || text);
      process.stderr.write('\n');
      active = false;
      return this;
    },
    fail(msg?: string) {
      if (!active) return this;
      if (timer) clearInterval(timer);
      clear();
      render(c.red('✖'), msg || text);
      process.stderr.write('\n');
      active = false;
      return this;
    },
    stop() {
      if (timer) clearInterval(timer);
      clear();
      active = false;
    }
  };
}

export function createProgressBar(total: number, label = 'Progress') {
  if (quietEnabled) {
    return { tick() {}, update() {}, stop() {} } as any;
  }
  let current = 0;
  const width = Math.max(20, Math.min(40, process.stdout.columns ? Math.floor(process.stdout.columns * 0.3) : 30));
  const draw = () => {
    const ratio = total === 0 ? 0 : current / total;
    const filled = Math.round(ratio * width);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
    const pct = (ratio * 100).toFixed(0).padStart(3, ' ');
    const line = `${c.cyan(label)} ${c.yellow('[' + bar + ']')} ${c.gray(`${current}/${total}`)} ${pct}%`;
    process.stderr.write(`\r${line}`);
  };
  const clear = () => process.stderr.write('\r\x1b[2K');
  draw();
  return {
    tick(n = 1) { current += n; if (current > total) current = total; draw(); },
    update(n: number) { current = Math.max(0, Math.min(total, n)); draw(); },
    stop(msg?: string) { clear(); if (msg) process.stderr.write(`${msg}\n`); },
  };
}

export function formatBytes(n: number): string {
  const units = ['B','KB','MB','GB','TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}
