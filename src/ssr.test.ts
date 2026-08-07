// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("SSR compatibility (no global window)", () => {
  it("importing the module does not throw even though window doesn't exist", async () => {
    expect(typeof window).toBe("undefined");

    const mod = await import("./index");

    expect(mod.getBiometricSupport).toBeTypeOf("function");
    expect(mod.isWebAuthnApiAvailable).toBeTypeOf("function");
    expect(mod.shouldShowBiometricLoginButton).toBeTypeOf("function");
  });

  it("isWebAuthnApiAvailable() returns false without throwing in SSR", async () => {
    const { isWebAuthnApiAvailable } = await import("./index");
    expect(isWebAuthnApiAvailable()).toBe(false);
  });

  it("getBiometricSupport() resolves with everything false without throwing in SSR", async () => {
    const { getBiometricSupport } = await import("./index");
    const result = await getBiometricSupport();

    expect(result).toEqual({
      isApiAvailable: false,
      isPlatformAuthenticatorAvailable: false,
      isConditionalMediationAvailable: false,
      isSecureContext: false,
    });
  });

  it("shouldShowBiometricLoginButton() resolves false without throwing in SSR", async () => {
    const { shouldShowBiometricLoginButton } = await import("./index");
    expect(await shouldShowBiometricLoginButton()).toBe(false);
  });
});