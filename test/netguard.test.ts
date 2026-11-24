import { describe, it, expect } from "vitest";
import { isPrivateIp, assertPublicUrl } from "../src/netguard.js";

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  it.each(["http://localhost", "http://foo.localhost", "http://[::1]/", "http://192.168.0.10", "ftp://example.com", "not a url", "http://metadata.google.internal"])(
    "rejects %s",
    async (url) => {
      await expect(assertPublicUrl(url)).rejects.toThrow();
    },
  );
  it("accepts a public IP literal", async () => {
    await expect(assertPublicUrl("https://8.8.8.8")).resolves.toBeUndefined();
  });
});
