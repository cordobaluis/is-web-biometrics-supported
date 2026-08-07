import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBiometricSupportCache,
  getBiometricSupport,
  isWebAuthnApiAvailable,
  shouldShowBiometricLoginButton,
} from "./index";

function mockPublicKeyCredential(overrides: {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  isConditionalMediationAvailable?: () => Promise<boolean>;
} = {}) {
  window.PublicKeyCredential = function PublicKeyCredential() {} as unknown as typeof PublicKeyCredential;

  if (overrides.isUserVerifyingPlatformAuthenticatorAvailable) {
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable =
      overrides.isUserVerifyingPlatformAuthenticatorAvailable;
  }

  if (overrides.isConditionalMediationAvailable) {
    window.PublicKeyCredential.isConditionalMediationAvailable =
      overrides.isConditionalMediationAvailable;
  }
}

function setSecureContext(value: boolean) {
  Object.defineProperty(window, "isSecureContext", {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  clearBiometricSupportCache();
  vi.restoreAllMocks();
  vi.useRealTimers();
  // @ts-expect-error -- limpieza entre tests, borrar propiedad de window es intencional
  delete window.PublicKeyCredential;
  setSecureContext(true);
});

describe("isWebAuthnApiAvailable", () => {
  it("retorna false si PublicKeyCredential no existe", () => {
    expect(isWebAuthnApiAvailable()).toBe(false);
  });

  it("retorna true si PublicKeyCredential existe como función", () => {
    mockPublicKeyCredential();
    expect(isWebAuthnApiAvailable()).toBe(true);
  });
});

describe("getBiometricSupport", () => {
  it("retorna todo en false si la API no existe", async () => {
    const result = await getBiometricSupport();
    expect(result).toEqual({
      isApiAvailable: false,
      isPlatformAuthenticatorAvailable: false,
      isConditionalMediationAvailable: false,
      isSecureContext: true,
    });
  });

  it("retorna todo en false y advierte si el contexto no es seguro, aunque la API exista", async () => {
    mockPublicKeyCredential({
      isUserVerifyingPlatformAuthenticatorAvailable: () =>
        Promise.resolve(true),
    });
    setSecureContext(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getBiometricSupport();

    expect(result.isApiAvailable).toBe(false);
    expect(result.isSecureContext).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("retorna true en los flags cuando el navegador soporta todo", async () => {
    mockPublicKeyCredential({
      isUserVerifyingPlatformAuthenticatorAvailable: () =>
        Promise.resolve(true),
      isConditionalMediationAvailable: () => Promise.resolve(true),
    });

    const result = await getBiometricSupport();

    expect(result).toEqual({
      isApiAvailable: true,
      isPlatformAuthenticatorAvailable: true,
      isConditionalMediationAvailable: true,
      isSecureContext: true,
    });
  });

  it("resuelve false (no cuelga ni rechaza) si la consulta nativa excede el timeout", async () => {
    mockPublicKeyCredential({
      isUserVerifyingPlatformAuthenticatorAvailable: () =>
        new Promise(() => {}), // nunca resuelve, simula hardware colgado
    });

    const result = await getBiometricSupport({ timeoutMs: 50 });

    expect(result.isPlatformAuthenticatorAvailable).toBe(false);
    expect(result.isApiAvailable).toBe(true); // la API sí existe, solo el hardware no respondió
  });

  it("cachea el resultado y no vuelve a llamar a la API nativa en la segunda invocación", async () => {
    const platformCheck = vi.fn(() => Promise.resolve(true));
    mockPublicKeyCredential({
      isUserVerifyingPlatformAuthenticatorAvailable: platformCheck,
    });

    await getBiometricSupport();
    await getBiometricSupport();

    expect(platformCheck).toHaveBeenCalledOnce();
  });

  it("invalida la caché si se llama con un timeoutMs distinto", async () => {
    const platformCheck = vi.fn(() => Promise.resolve(true));
    mockPublicKeyCredential({
      isUserVerifyingPlatformAuthenticatorAvailable: platformCheck,
    });

    await getBiometricSupport({ timeoutMs: 1000 });
    await getBiometricSupport({ timeoutMs: 2000 });

    expect(platformCheck).toHaveBeenCalledTimes(2);
  });
});

describe("shouldShowBiometricLoginButton", () => {
  it("retorna false si no hay soporte", async () => {
    expect(await shouldShowBiometricLoginButton()).toBe(false);
  });

  it("retorna true solo si API y autenticador de plataforma están disponibles", async () => {
    mockPublicKeyCredential({
      isUserVerifyingPlatformAuthenticatorAvailable: () =>
        Promise.resolve(true),
    });
    expect(await shouldShowBiometricLoginButton()).toBe(true);
  });

  it("retorna false si la API existe pero no hay autenticador de plataforma", async () => {
    mockPublicKeyCredential({
      isUserVerifyingPlatformAuthenticatorAvailable: () =>
        Promise.resolve(false),
    });
    expect(await shouldShowBiometricLoginButton()).toBe(false);
  });
});