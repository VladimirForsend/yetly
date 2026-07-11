import { afterEach, describe, expect, it, vi } from "vitest";
import { managedCloudAvailable, managedCloudBaseUrl } from "./managed-cloud-client";

describe("managed cloud configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("removes trailing slashes from the configured Control Plane URL", () => {
    vi.stubEnv("VITE_YETLY_MANAGED_CLOUD_URL", "https://control.example/functions/v1/managed-cloud///");
    expect(managedCloudAvailable()).toBe(true);
    expect(managedCloudBaseUrl()).toBe("https://control.example/functions/v1/managed-cloud");
  });

  it("keeps managed setup disabled until the developer configures the service", () => {
    vi.stubEnv("VITE_YETLY_MANAGED_CLOUD_URL", "");
    expect(managedCloudAvailable()).toBe(false);
    expect(() => managedCloudBaseUrl()).toThrow(/todavía no está habilitado/i);
  });
});
