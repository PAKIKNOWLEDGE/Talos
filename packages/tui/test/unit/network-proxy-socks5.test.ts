import type { Dispatcher } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureTuiNetworkProxy,
  createTuiNetworkDispatcher,
} from '../../src/cli/network-proxy.js';

/**
 * Agent construction coverage for SOCKS5 proxies.
 *
 * Socks5ProxyAgent, ProxyAgent, Agent, and buildConnector are mocked so these
 * tests never open a socket or call a live network. Dispatch assertions record
 * which mock agent received the request.
 */

const SOCKS5_WARNING = 'SOCKS5 proxy support is experimental and subject to change';

interface ConnectOptions {
  hostname: string;
  host?: string;
  protocol: string;
  port: string;
}

interface ConnectCallback {
  (error: Error | null, socket: { destroy(): void } | null): void;
}

interface SocksOptions {
  connectTimeout?: number;
  username?: string;
  password?: string;
  connect?: (options: ConnectOptions, callback: ConnectCallback) => void;
}

interface SocksRecord {
  href: string;
  protocol: string;
  username: string;
  password: string;
  options: SocksOptions;
  dispatchOrigins: string[];
}

interface DirectRecord {
  dispatchOrigins: string[];
}

interface ProxyRecord {
  options: Record<string, unknown>;
  dispatchOrigins: string[];
}

const recorded = vi.hoisted(() => ({
  socks: [] as SocksRecord[],
  proxies: [] as ProxyRecord[],
  directs: [] as DirectRecord[],
  connectorBuilds: [] as unknown[],
  connectorCalls: [] as Array<{ hostname: string; host?: string }>,
}));

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof import('undici')>('undici');

  class MockDirectAgent extends actual.Dispatcher {
    readonly dispatchOrigins: string[] = [];

    constructor() {
      super();
      recorded.directs.push(this);
    }

    override dispatch(options: { origin?: string | URL }): boolean {
      this.dispatchOrigins.push(String(options.origin ?? ''));
      return true;
    }

    override close(): Promise<void> {
      return Promise.resolve();
    }

    override destroy(): Promise<void> {
      return Promise.resolve();
    }
  }

  class MockProxyAgent extends actual.Dispatcher {
    readonly dispatchOrigins: string[] = [];

    constructor(options: Record<string, unknown> = {}) {
      super();
      recorded.proxies.push({ options, dispatchOrigins: this.dispatchOrigins });
    }

    override dispatch(options: { origin?: string | URL }): boolean {
      this.dispatchOrigins.push(String(options.origin ?? ''));
      return true;
    }

    override close(): Promise<void> {
      return Promise.resolve();
    }

    override destroy(): Promise<void> {
      return Promise.resolve();
    }
  }

  class MockSocks5ProxyAgent extends actual.Dispatcher {
    readonly dispatchOrigins: string[] = [];

    constructor(proxyUrl: string | URL, options: SocksOptions = {}) {
      super();
      process.emitWarning(SOCKS5_WARNING, 'ExperimentalWarning');
      const url = typeof proxyUrl === 'string' ? new URL(proxyUrl) : proxyUrl;
      recorded.socks.push({
        href: url.href,
        protocol: url.protocol,
        username: url.username,
        password: url.password,
        options,
        dispatchOrigins: this.dispatchOrigins,
      });
    }

    override dispatch(options: { origin?: string | URL }): boolean {
      this.dispatchOrigins.push(String(options.origin ?? ''));
      return true;
    }

    override close(): Promise<void> {
      return Promise.resolve();
    }

    override destroy(): Promise<void> {
      return Promise.resolve();
    }
  }

  const buildConnector = (options?: unknown) => {
    recorded.connectorBuilds.push(options);
    return (connectOptions: ConnectOptions, callback: ConnectCallback) => {
      recorded.connectorCalls.push({
        hostname: connectOptions.hostname,
        host: connectOptions.host,
      });
      callback(null, { destroy() {} });
    };
  };

  return {
    ...actual,
    Agent: MockDirectAgent,
    ProxyAgent: MockProxyAgent,
    Socks5ProxyAgent: MockSocks5ProxyAgent,
    buildConnector,
  };
});

const dispatchHandler = {} as Dispatcher.DispatchHandler;

function dispatchTo(dispatcher: Dispatcher, origin: string): void {
  dispatcher.dispatch(
    { origin, path: '/', method: 'GET' } as Dispatcher.DispatchOptions,
    dispatchHandler,
  );
}

async function warningsFrom(run: () => void): Promise<string[]> {
  const warnings: string[] = [];
  const onWarning = (warning: Error) => warnings.push(warning.message);
  process.on('warning', onWarning);
  try {
    run();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    return warnings;
  } finally {
    process.off('warning', onWarning);
  }
}

beforeEach(() => {
  recorded.socks.length = 0;
  recorded.proxies.length = 0;
  recorded.directs.length = 0;
  recorded.connectorBuilds.length = 0;
  recorded.connectorCalls.length = 0;
});

describe('SOCKS5 proxy agent selection', () => {
  it.each([
    ['socks5://127.0.0.1:1080', 'socks5:'],
    [' socks://127.0.0.1:1080\n', 'socks:'],
    ['socks5h://127.0.0.1:1080', 'socks5:'],
  ])('uses Socks5ProxyAgent for ALL_PROXY=%j', async (value, protocol) => {
    const originalEmitWarning = process.emitWarning;
    let dispatcher: Dispatcher | undefined;
    const warnings = await warningsFrom(() => {
      dispatcher = createTuiNetworkDispatcher({ ALL_PROXY: value });
    });

    expect(dispatcher).toBeDefined();
    expect(recorded.proxies).toEqual([]);
    expect(recorded.socks).toHaveLength(1);
    expect(recorded.socks[0]?.protocol).toBe(protocol);
    expect(recorded.socks[0]?.username).toBe('');
    expect(recorded.socks[0]?.password).toBe('');
    expect(new URL(recorded.socks[0]?.href ?? '').hostname).toBe('127.0.0.1');
    expect(recorded.socks[0]?.options.connectTimeout).toBe(5_000);
    expect(recorded.connectorBuilds).toEqual([{ timeout: 5_000 }]);
    expect(recorded.connectorCalls).toEqual([]);
    expect(warnings.filter((message) => message.includes('SOCKS5'))).toEqual([]);
    expect(process.emitWarning).toBe(originalEmitWarning);
  });

  it('decodes credentials, drops them from the URL, and rewrites socks5h to socks5', async () => {
    const warnings = await warningsFrom(() => {
      createTuiNetworkDispatcher({
        ALL_PROXY: ' socks5h://mcode%20user:p%40ss%3Aword@127.0.0.1:1080 ',
      });
    });

    expect(warnings.filter((message) => message.includes('SOCKS5'))).toEqual([]);
    expect(recorded.socks).toHaveLength(1);
    expect(recorded.socks[0]).toMatchObject({
      protocol: 'socks5:',
      username: '',
      password: '',
      options: { username: 'mcode user', password: 'p@ss:word', connectTimeout: 5_000 },
    });
    expect(recorded.socks[0]?.href).not.toContain('mcode');
    expect(recorded.socks[0]?.href).not.toContain('socks5h');
    expect(recorded.socks[0]?.href).not.toContain('p%40ss');
  });

  it('treats an empty password as no SOCKS5 credentials', () => {
    createTuiNetworkDispatcher({ ALL_PROXY: 'socks5://mcode:@127.0.0.1:1080' });

    expect(recorded.socks[0]?.options.username).toBe('mcode');
    expect(recorded.socks[0]?.options).not.toHaveProperty('password');
    expect(recorded.socks[0]?.username).toBe('');
  });

  it('strips IPv6 brackets before the mocked connector dials the proxy', () => {
    createTuiNetworkDispatcher({ ALL_PROXY: 'socks5://mcode:p%40ss@[::1]:1080' });
    const connect = recorded.socks[0]?.options.connect;
    expect(connect).toEqual(expect.any(Function));
    if (!connect) throw new Error('Expected a SOCKS5 connector');

    connect({ hostname: '[::1]', host: '[::1]', protocol: 'http:', port: '1080' }, () => undefined);
    connect({ hostname: '[::1]', protocol: 'http:', port: '1080' }, () => undefined);

    expect(recorded.connectorCalls).toEqual([
      { hostname: '::1', host: '::1' },
      { hostname: '::1', host: undefined },
    ]);
  });

  it('sends NO_PROXY hosts to the direct agent and other hosts to Socks5ProxyAgent', () => {
    const dispatcher = createTuiNetworkDispatcher({
      ALL_PROXY: 'socks5://127.0.0.1:1080',
      NO_PROXY: 'internal.example.invalid',
    });

    dispatchTo(dispatcher, 'http://127.0.0.1/direct');
    dispatchTo(dispatcher, 'http://internal.example.invalid/direct');
    dispatchTo(dispatcher, 'http://target.socks.invalid/through');
    dispatchTo(dispatcher, 'https://secure.socks.invalid/through');

    expect(recorded.directs[0]?.dispatchOrigins).toEqual([
      'http://127.0.0.1/direct',
      'http://internal.example.invalid/direct',
    ]);
    expect(recorded.socks[0]?.dispatchOrigins).toEqual([
      'http://target.socks.invalid/through',
      'https://secure.socks.invalid/through',
    ]);
    expect(recorded.connectorCalls).toEqual([]);
  });

  it('keeps an explicit HTTP proxy on ProxyAgent and HTTPS on Socks5ProxyAgent', () => {
    const dispatcher = createTuiNetworkDispatcher({
      HTTP_PROXY: 'http://127.0.0.1:8080',
      HTTPS_PROXY: 'socks5://127.0.0.1:1080',
    });

    dispatchTo(dispatcher, 'http://plain.example.invalid/');
    dispatchTo(dispatcher, 'https://secure.example.invalid/');
    dispatchTo(dispatcher, 'http://localhost/bypass');

    expect(recorded.proxies).toEqual([
      expect.objectContaining({
        options: {
          uri: 'http://127.0.0.1:8080',
          allowH2: false,
          proxyTls: { allowH2: false },
          proxyTunnel: true,
        },
        dispatchOrigins: ['http://plain.example.invalid/'],
      }),
    ]);
    expect(recorded.socks[0]?.dispatchOrigins).toEqual(['https://secure.example.invalid/']);
    expect(recorded.directs[0]?.dispatchOrigins).toEqual(['http://localhost/bypass']);
    expect(recorded.connectorCalls).toEqual([]);
  });

  it('installs a SOCKS5 dispatcher at startup instead of failing', async () => {
    const warnings: string[] = [];
    let installed: Dispatcher | undefined;
    const processWarnings = await warningsFrom(() => {
      const configuration = configureTuiNetworkProxy({
        environment: { ALL_PROXY: 'socks5://127.0.0.1:1080' },
        setGlobalDispatcher: (dispatcher) => {
          installed = dispatcher;
        },
        installFetch: () => undefined,
        writeWarning: (message) => warnings.push(message),
      });
      expect(configuration.mode).toBe('proxy');
    });

    expect(warnings).toEqual([]);
    expect(processWarnings.filter((message) => message.includes('SOCKS5'))).toEqual([]);
    expect(installed).toBeDefined();
    expect(recorded.socks).toHaveLength(1);
    expect(recorded.socks[0]?.protocol).toBe('socks5:');
  });

  it('starts without a proxy when ALL_PROXY is unsupported', () => {
    const warnings: string[] = [];
    let installed = false;

    const configuration = configureTuiNetworkProxy({
      environment: { ALL_PROXY: 'socks4://alice:s3cr3t@127.0.0.1:1080' },
      setGlobalDispatcher: () => {
        installed = true;
      },
      installFetch: () => undefined,
      writeWarning: (message) => warnings.push(message),
    });

    expect(configuration).toEqual({ mode: 'direct' });
    expect(installed).toBe(false);
    expect(recorded.socks).toEqual([]);
    expect(recorded.proxies).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ALL_PROXY=socks4://***:***@127.0.0.1:1080');
    expect(warnings[0]).not.toContain('alice');
    expect(warnings[0]).not.toContain('s3cr3t');
  });

  it('keeps an explicit SOCKS5 proxy when ALL_PROXY credentials are malformed', () => {
    const warnings: string[] = [];
    let installed: Dispatcher | undefined;

    configureTuiNetworkProxy({
      environment: {
        ALL_PROXY: 'socks5://user:50%off@127.0.0.1:1080',
        HTTP_PROXY: 'socks5://127.0.0.1:1080',
      },
      setGlobalDispatcher: (dispatcher) => {
        installed = dispatcher;
      },
      installFetch: () => undefined,
      writeWarning: (message) => warnings.push(message),
    });

    expect(installed).toBeDefined();
    expect(warnings[0]).toContain('ALL_PROXY=socks5://***:***@127.0.0.1:1080');
    expect(warnings[0]).not.toContain('50%off');
    expect(recorded.socks).toHaveLength(1);
    expect(recorded.socks[0]?.protocol).toBe('socks5:');
    expect(new URL(recorded.socks[0]?.href ?? '').port).toBe('1080');
    if (!installed) throw new Error('Expected a global dispatcher');
    dispatchTo(installed, 'http://explicit.socks.invalid/');
    expect(recorded.socks[0]?.dispatchOrigins).toEqual(['http://explicit.socks.invalid/']);
  });

  it.each(['HTTP_PROXY', 'HTTPS_PROXY'])(
    'still fails startup for an explicit invalid %s',
    (name) => {
      let installed = false;
      expect(() =>
        configureTuiNetworkProxy({
          environment: { [name]: 'not a url' },
          setGlobalDispatcher: () => {
            installed = true;
          },
          installFetch: () => undefined,
          writeWarning: () => {
            throw new Error('explicit proxy failures must throw, not warn');
          },
        }),
      ).toThrow(`${name} must be an http://, https://, socks5://, or socks5h:// URL.`);
      expect(installed).toBe(false);
      expect(recorded.socks).toEqual([]);
    },
  );

  it.each(['HTTP_PROXY', 'HTTPS_PROXY'])(
    'still fails startup for explicit %s credentials that are not percent-encoded',
    (name) => {
      let installed = false;
      expect(() =>
        configureTuiNetworkProxy({
          environment: { [name]: 'socks5://user:50%off@127.0.0.1:1080' },
          setGlobalDispatcher: () => {
            installed = true;
          },
          installFetch: () => undefined,
        }),
      ).toThrow(/not valid percent-encoding/);
      expect(installed).toBe(false);
      expect(recorded.socks).toEqual([]);
    },
  );
});
