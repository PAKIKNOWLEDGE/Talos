import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __IS_NPM_BUILD__: boolean | undefined;

const LINUX_PLAYERS = ['pw-play', 'paplay'] as const;

export type TuiStartupSoundSpawn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

export interface PlayTuiStartupSoundOptions {
  readonly platform?: NodeJS.Platform;
  readonly soundPath?: string;
  readonly spawn?: TuiStartupSoundSpawn;
  readonly exists?: (path: string) => boolean;
  readonly env?: Readonly<NodeJS.ProcessEnv>;
}

export function shouldPlayTuiStartupSound(options: {
  readonly resumeDraftAfterLogin?: boolean;
}): boolean {
  return options.resumeDraftAfterLogin !== true;
}

export function resolveTuiStartupSoundPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return typeof __IS_NPM_BUILD__ !== 'undefined' && __IS_NPM_BUILD__
    ? resolve(here, 'assets/tui/endfield-boot.wav')
    : resolve(here, '../../assets/endfield-boot.wav');
}

/** Fire-and-forget. Failures never affect TUI launch. */
export function playTuiStartupSound(options: PlayTuiStartupSoundOptions = {}): void {
  try {
    void playTuiStartupSoundAsync(options);
  } catch {
    // Startup audio must never affect TUI launch.
  }
}

export async function playTuiStartupSoundAsync(
  options: PlayTuiStartupSoundOptions = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  const soundPath = options.soundPath ?? resolveTuiStartupSoundPath();
  const exists = options.exists ?? existsSync;
  const spawnImpl = options.spawn ?? spawn;
  try {
    if (!exists(soundPath)) return;
    if (platform === 'win32') {
      await spawnPlayer(spawnImpl, resolveWindowsPowerShell(options.env ?? process.env), [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-Command',
        `(New-Object System.Media.SoundPlayer ${powershellLiteral(soundPath)}).PlaySync()`,
      ], { detached: false });
      return;
    }
    if (platform !== 'linux') return;
    for (const command of LINUX_PLAYERS) {
      if (await spawnPlayer(spawnImpl, command, [soundPath], { detached: true })) return;
    }
  } catch {
    // Missing players, WSL without a session bus, and bad paths stay silent.
  }
}

function resolveWindowsPowerShell(env: Readonly<NodeJS.ProcessEnv>): string {
  return join(
    env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
}

function powershellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function spawnPlayer(
  spawnImpl: TuiStartupSoundSpawn,
  command: string,
  args: readonly string[],
  options: { readonly detached: boolean },
): Promise<boolean> {
  return new Promise((resolveStarted) => {
    let settled = false;
    const finish = (started: boolean) => {
      if (settled) return;
      settled = true;
      resolveStarted(started);
    };
    try {
      const child = spawnImpl(command, [...args], {
        detached: options.detached,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.once('error', () => finish(false));
      child.once('spawn', () => {
        child.unref();
        finish(true);
      });
    } catch {
      finish(false);
    }
  });
}
