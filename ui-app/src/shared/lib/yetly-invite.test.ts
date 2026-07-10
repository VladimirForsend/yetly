import { describe, expect, it } from "vitest";
import { createYetlyInviteMessage, createYetlyInviteUrl } from "./yetly-invite";

const config = {
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_test-key",
};

describe("Yetly invitation", () => {
  it("includes the team code and public Supabase connection", () => {
    const url = createYetlyInviteUrl("https://example.github.io/yetly/#/settings", "abc123", config);

    expect(url).toContain("https://example.github.io/yetly/#/connect-supabase?");
    expect(url).toContain("invite=ABC123");
    expect(url).toContain("supabaseUrl=https%3A%2F%2Fexample.supabase.co");
    expect(url).toContain("publishableKey=sb_publishable_test-key");
  });

  it("copies a usable invitation message instead of a bare code", () => {
    const message = createYetlyInviteMessage("https://example.github.io/yetly/", "ABC123", config);

    expect(message).toContain("Entra aquí: https://example.github.io/yetly/#/connect-supabase?");
    expect(message).toContain("código de invitación ya van incluidos");
  });
});
