import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAuthRedirectIntent,
  clearPasswordRecoveryIntent,
  getAuthRedirectError,
  getGoogleProviderStatus,
  isPasswordRecoveryPending,
} from "./supabase-connection";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
  };
}

describe("Supabase Auth redirects", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { hash: "", search: "", origin: "https://example.github.io", pathname: "/yetly/" },
      sessionStorage: storage(), localStorage: storage(), atob,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("detects a password recovery redirect before HashRouter handles it", () => {
    window.location.hash = "#access_token=test&type=recovery";
    captureAuthRedirectIntent();
    expect(isPasswordRecoveryPending()).toBe(true);
    clearPasswordRecoveryIntent();
    expect(isPasswordRecoveryPending()).toBe(false);
  });

  it("reads OAuth errors returned in either query or fragment", () => {
    window.location.hash = "#error=access_denied&error_description=Google+cancelado";
    expect(getAuthRedirectError()).toBe("Google cancelado");
  });

  it("checks whether Google is really enabled before showing a working button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) }));
    await expect(getGoogleProviderStatus({ url: "https://example.supabase.co", publishableKey: "sb_publishable_test" })).resolves.toEqual({ enabled: true, checked: true });
  });
});
