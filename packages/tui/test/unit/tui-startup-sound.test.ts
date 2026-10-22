import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import type { Terminal } from '../../src/tui/engine/public.js';
import { launchTui } from '../../src/tui/launcher.js';
import {
  playTuiStartupSoundAsync,
  resolveTuiStartupSoundPath,
  shouldPlayTuiStartupSound,
} from '../../src/host/startup-sound.js';

function stubTerminal(): Terminal {
  return {
    start() {},
    stop() {},
    async drainInput() {},
    write() {},
    columns: 80,
    rows: 24,
    kittyProtocolActive: false,
    moveBy() {},
    hideCursor() {},
    showCursor() {},
    clearLine() {},
    clearFromCursor() {},
    clearScreen() {},
    setTitle() {},
    setProgress() {},
  };
}

async function launchUntilDataDir(
  options: { readonly resumeDraftAfterLogin?: boolean; readonly skin?: 'classic' | 'collapsal' },
  playStartupSound: () => void,
): Promise<void> {
  await expect(
    launchTui(
      { version: '0.0.0', terminal: stubTerminal(), ...options },
      {
        playStartupSound,
        prepareDataDir: async () => {
          throw new Error('stop after startup sound');
        },
      },
    ),
  ).rejects.toThrow('stop after startup sound');
}

function fakeChild(result: 'spawn' | 'error'): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  child.unref = vi.fn();
  queueMicrotask(() => {
    if (result === 'error') child.emit('error', new Error('ENOENT'));
    else child.emit('spawn');
  });
  return child;
}

describe('TUI startup sound policy', () => {
  it('plays on a normal interactive launch for every skin', () => {
    expect(shouldPlayTuiStartupSound({})).toBe(true);
    expect(shouldPlayTuiStartupSound({ resumeDraftAfterLogin: false })).toBe(true);
  });

  it('skips the login-restart process', () => {
    expect(shouldPlayTuiStartupSound({ resumeDraftAfterLogin: true })).toBe(false);
  });

  it('plays from launchTui for Classic and Collapsal, and skips login restart', async () => {
    const playStartupSound = vi.fn();
    await launchUntilDataDir({ skin: 'classic' }, playStartupSound);
    await launchUntilDataDir({ skin: 'collapsal' }, playStartupSound);
    await launchUntilDataDir({ resumeDraftAfterLogin: true, skin: 'collapsal' }, playStartupSound);
    expect(playStartupSound).toHaveBeenCalledTimes(2);
  });
});

describe('TUI startup sound playback', () => {
  it('resolves the packaged wav from source', () => {
    expect(resolveTuiStartupSoundPath().replaceAll('\\', '/')).toMatch(
      /packages\/tui\/assets\/endfield-boot\.wav$/u,
    );
  });

  it('plays PCM wav through Windows SoundPlayer without waiting on the TUI', async () => {
    const spawnImpl = vi.fn(() => fakeChild('spawn'));
    await playTuiStartupSoundAsync({
      platform: 'win32',
      soundPath: String.raw`C:\Talos\endfield-boot.wav`,
      exists: () => true,
      env: { SystemRoot: 'C:\\Windows' },
      spawn: spawnImpl,
    });
    expect(spawnImpl).toHaveBeenCalledOnce();
    const [command, args, options] = spawnImpl.mock.calls[0] ?? [];
    expect(command).toBe(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`);
    expect(args).toEqual([
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      `(New-Object System.Media.SoundPlayer 'C:\\Talos\\endfield-boot.wav').PlaySync()`,
    ]);
    expect(options).toMatchObject({ detached: false, stdio: 'ignore', windowsHide: true });
  });

  it('escapes PowerShell single quotes in the wav path', async () => {
    const spawnImpl = vi.fn(() => fakeChild('spawn'));
    await playTuiStartupSoundAsync({
      platform: 'win32',
      soundPath: String.raw`C:\O'Brien\endfield-boot.wav`,
      exists: () => true,
      spawn: spawnImpl,
    });
    expect(String(spawnImpl.mock.calls[0]?.[1]?.at(-1))).toContain(
      `'C:\\O''Brien\\endfield-boot.wav'`,
    );
  });

  it('uses pw-play on Linux and falls back to paplay', async () => {
    const spawnImpl = vi
      .fn()
      .mockImplementationOnce(() => fakeChild('error'))
      .mockImplementationOnce(() => fakeChild('spawn'));
    await playTuiStartupSoundAsync({
      platform: 'linux',
      soundPath: '/nix/store/talos/endfield-boot.wav',
      exists: () => true,
      spawn: spawnImpl,
    });
    expect(spawnImpl.mock.calls.map((call) => call[0])).toEqual(['pw-play', 'paplay']);
    expect(spawnImpl.mock.calls[1]?.[1]).toEqual(['/nix/store/talos/endfield-boot.wav']);
  });

  it('does not spawn a player on macOS or when the wav is missing', async () => {
    const spawnImpl = vi.fn(() => fakeChild('spawn'));
    await playTuiStartupSoundAsync({
      platform: 'darwin',
      soundPath: '/tmp/endfield-boot.wav',
      exists: () => true,
      spawn: spawnImpl,
    });
    await playTuiStartupSoundAsync({
      platform: 'win32',
      soundPath: '/missing.wav',
      exists: () => false,
      spawn: spawnImpl,
    });
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('swallows spawn failures', async () => {
    await expect(
      playTuiStartupSoundAsync({
        platform: 'linux',
        soundPath: '/tmp/endfield-boot.wav',
        exists: () => true,
        spawn: () => {
          throw new Error('spawn blocked');
        },
      }),
    ).resolves.toBeUndefined();
  });
});
