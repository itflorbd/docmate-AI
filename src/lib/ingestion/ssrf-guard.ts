import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import net from 'net';

export interface SafeFetchOptions {
  maxRedirects?: number;
  maxSizeBytes?: number;
  timeoutMs?: number;
  allowedContentTypes?: string[];
  userAgent?: string;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (!net.isIP(ip)) return true;

  // IPv4 private/reserved blocks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local, cloud metadata e.g. 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 224.0.0.0/4 (multicast)
    if (parts[0] >= 224) return true;
    return false;
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
    return true;
  }

  return false;
}

export async function assertSafeUrl(urlString: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF Guard: Protocol "${parsed.protocol}" is not allowed. Only HTTP and HTTPS are permitted.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicit localhost checks
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    throw new Error(`SSRF Guard: Localhost and internal hostnames (${hostname}) are blocked.`);
  }

  // Resolve DNS to verify real IP addresses
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`SSRF Guard: Unable to resolve hostname ${hostname}`);
    }

    for (const addr of addresses) {
      if (isPrivateOrReservedIp(addr.address)) {
        throw new Error(
          `SSRF Guard: Hostname ${hostname} resolved to private/reserved IP (${addr.address}), which is forbidden.`
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('SSRF Guard:')) throw err;
    throw new Error(`SSRF Guard: DNS lookup failed for ${hostname}: ${msg}`);
  }

  return parsed;
}

export async function safeFetchUrl(
  urlString: string,
  options: SafeFetchOptions = {}
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const maxRedirects = options.maxRedirects ?? 3;
  const maxSizeBytes = options.maxSizeBytes ?? 100 * 1024 * 1024; // 100MB
  const timeoutMs = options.timeoutMs ?? 15000;
  const userAgent = options.userAgent ?? 'DocMate-AI-Clinical-Ingestion-Bot/1.0 (+https://docmate.ai; clinical-bot@docmate.ai)';

  let currentUrl = urlString;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const parsed = await assertSafeUrl(currentUrl);

    const client = parsed.protocol === 'https:' ? https : http;

    const res = await new Promise<{
      statusCode: number;
      headers: http.IncomingHttpHeaders;
      buffer: Buffer;
    }>((resolve, reject) => {
      const req = client.get(
        parsed.toString(),
        {
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,application/pdf,application/json,text/plain;q=0.9',
          },
          timeout: timeoutMs,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let totalBytes = 0;

          response.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > maxSizeBytes) {
              req.destroy();
              reject(new Error(`SSRF Guard: Response size exceeded maximum limit of ${maxSizeBytes} bytes.`));
              return;
            }
            chunks.push(chunk);
          });

          response.on('end', () => {
            resolve({
              statusCode: response.statusCode || 200,
              headers: response.headers,
              buffer: Buffer.concat(chunks),
            });
          });

          response.on('error', (err) => reject(err));
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`SSRF Guard: Request timed out after ${timeoutMs}ms.`));
      });

      req.on('error', (err) => reject(err));
    });

    // Handle redirects
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`SSRF Guard: Too many redirects (maximum ${maxRedirects} allowed).`);
      }
      currentUrl = new URL(res.headers.location, currentUrl).toString();
      continue;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`Failed to fetch URL: HTTP ${res.statusCode}`);
    }

    const contentType = res.headers['content-type'] || 'text/html';

    return {
      buffer: res.buffer,
      contentType,
      finalUrl: currentUrl,
    };
  }

  throw new Error(`SSRF Guard: Maximum redirects exceeded.`);
}
