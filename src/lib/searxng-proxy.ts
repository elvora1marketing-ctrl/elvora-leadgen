import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

export interface ProxyEntry {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export function parseProxyList(text: string): ProxyEntry[] {
  return text.trim().split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(line => {
      const p = line.split(':');
      if (p.length < 4) return null;
      return { host: p[0], port: parseInt(p[1]), user: p[2], pass: p.slice(3).join(':') };
    })
    .filter((p): p is ProxyEntry => p !== null && !isNaN(p.port));
}

const SEARXNG_SETTINGS = '/opt/searxng/settings.yml';

export function configureSearXNGProxies(proxyText: string): { count: number; error?: string } {
  const entries = parseProxyList(proxyText);
  if (entries.length === 0) return { count: 0, error: 'Keine gueltigen Proxies' };

  if (!existsSync(SEARXNG_SETTINGS)) {
    return { count: 0, error: `${SEARXNG_SETTINGS} nicht gefunden` };
  }

  const proxyLines = entries.map(p =>
    `      - http://${encodeURIComponent(p.user)}:${encodeURIComponent(p.pass)}@${p.host}:${p.port}`
  ).join('\n');

  const newOutgoing = `outgoing:
  request_timeout: 10.0
  pool_connections: 100
  pool_maxsize: 20
  proxies:
    all://:
${proxyLines}`;

  try {
    let yml = readFileSync(SEARXNG_SETTINGS, 'utf-8');

    if (yml.includes('outgoing:')) {
      yml = yml.replace(/outgoing:[\s\S]*$/, newOutgoing);
    } else {
      yml += '\n' + newOutgoing + '\n';
    }

    writeFileSync(SEARXNG_SETTINGS, yml, 'utf-8');
    execSync('docker restart elvora-searxng', { timeout: 30000 });
    return { count: entries.length };
  } catch (e) {
    return { count: 0, error: `${e instanceof Error ? e.message : 'Unbekannt'}` };
  }
}
