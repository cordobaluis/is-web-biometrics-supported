import { describe, expect, it } from "vitest";

/**
 * Este archivo corre en entorno "node" (sin window/document) para simular
 * un Server Component o build-time de Next.js/Nuxt. Se declara aparte de
 * index.test.ts porque ese usa environment "happy-dom" (con window).
 *
 * @vitest-environment node
 */
describe("compatibilidad SSR (sin window global)", () => {
  it("importar el módulo no lanza error aunque window no exista", async () => {
    expect(typeof window).toBe("undefined");

    const mod = await import("./index");

    expect(mod.getBiometricSupport).toBeTypeOf("function");
    expect(mod.isWebAuthnApiAvailable).toBeTypeOf("function");
    expect(mod.shouldShowBiometricLoginButton).toBeTypeOf("function");
  });

  it("isWebAuthnApiAvailable() retorna false sin lanzar error en SSR", async () => {
    const { isWebAuthnApiAvailable } = await import("./index");
    expect(isWebAuthnApiAvailable()).toBe(false);
  });

  it("getBiometricSupport() resuelve con todo en false sin lanzar error en SSR", async () => {
    const { getBiometricSupport } = await import("./index");
    const result = await getBiometricSupport();

    expect(result).toEqual({
      isApiAvailable: false,
      isPlatformAuthenticatorAvailable: false,
      isConditionalMediationAvailable: false,
      isSecureContext: false,
    });
  });

  it("shouldShowBiometricLoginButton() resuelve false sin lanzar error en SSR", async () => {
    const { shouldShowBiometricLoginButton } = await import("./index");
    expect(await shouldShowBiometricLoginButton()).toBe(false);
  });
});