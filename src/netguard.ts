import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class BlockedUrlError extends Error {}

/** True for loopback, private, link-local, cloud-metadata and other non-public addresses. */
export function isPrivateIp(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);

  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    /^fe[89ab]/.test(v6) ||
    v6.startsWith("ff")
  );
}

export type UrlGuard = (url: string) => Promise<void>;

/** Reject non-http(s) URLs and any host that resolves to a non-public address. */
export const assertPublicUrl: UrlGuard = async (rawUrl) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("Only http and https URLs are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new BlockedUrlError("Private addresses are not allowed");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new BlockedUrlError("Host could not be resolved");
  });
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new BlockedUrlError("Private addresses are not allowed");
  }
};

export const allowAnyUrl: UrlGuard = async () => {};
