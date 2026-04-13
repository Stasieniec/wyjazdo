import { describe, it, expect } from "vitest";
import { resolveTenant } from "./tenant";

const ROOT = "wyjazdo.pl";

describe("resolveTenant", () => {
  it("apex domain returns kind=apex", () => {
    expect(resolveTenant("wyjazdo.pl", ROOT)).toEqual({ kind: "apex" });
  });

  it("www is treated as apex", () => {
    expect(resolveTenant("www.wyjazdo.pl", ROOT)).toEqual({ kind: "apex" });
  });

  it("reserved subdomain is treated as apex", () => {
    expect(resolveTenant("api.wyjazdo.pl", ROOT)).toEqual({ kind: "apex" });
    expect(resolveTenant("app.wyjazdo.pl", ROOT)).toEqual({ kind: "apex" });
  });

  it("organizer subdomain returns kind=tenant with subdomain", () => {
    expect(resolveTenant("acme.wyjazdo.pl", ROOT)).toEqual({
      kind: "tenant",
      subdomain: "acme",
    });
  });

  it("subdomain is lowercased", () => {
    expect(resolveTenant("ACME.wyjazdo.pl", ROOT)).toEqual({
      kind: "tenant",
      subdomain: "acme",
    });
  });

  it("port is handled on localhost", () => {
    expect(resolveTenant("acme.localhost:3000", "localhost:3000")).toEqual({
      kind: "tenant",
      subdomain: "acme",
    });
    expect(resolveTenant("localhost:3000", "localhost:3000")).toEqual({ kind: "apex" });
  });

  it("host not matching root returns kind=unknown", () => {
    expect(resolveTenant("evil.example.com", ROOT)).toEqual({ kind: "unknown" });
  });
});
