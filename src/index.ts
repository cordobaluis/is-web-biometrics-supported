export interface BiometricSupport {
  isApiAvailable: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  isConditionalMediationAvailable: boolean;
  isSecureContext: boolean;
}

export interface GetBiometricSupportOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2500;

let cachedSupport: BiometricSupport | null = null;
let cachedTimeoutMs: number | null = null;

export function isWebAuthnApiAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function"
  );
}

function withTimeout(
  promise: Promise<boolean>,
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      }
    );
  });
}

export async function getBiometricSupport(
  options: GetBiometricSupportOptions = {}
): Promise<BiometricSupport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (cachedSupport && cachedTimeoutMs === timeoutMs) {
    return cachedSupport;
  }

  const isSecureContext =
    typeof window !== "undefined" && window.isSecureContext === true;

  if (typeof window !== "undefined" && !isSecureContext) {
    console.warn(
      "[is-web-biometrics-supported] This document is not in a secure context (HTTPS or localhost). " +
        "WebAuthn won't work even if the browser technically supports it. " +
        "Serve your app over HTTPS to enable biometrics."
    );
  }

  const isApiAvailable = isWebAuthnApiAvailable() && isSecureContext;

  if (!isApiAvailable) {
    const result: BiometricSupport = {
      isApiAvailable: false,
      isPlatformAuthenticatorAvailable: false,
      isConditionalMediationAvailable: false,
      isSecureContext,
    };
    cachedSupport = result;
    cachedTimeoutMs = timeoutMs;
    return result;
  }

  const PKC = window.PublicKeyCredential;

  const platformCheck: Promise<boolean> =
    typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable === "function"
      ? PKC.isUserVerifyingPlatformAuthenticatorAvailable()
      : Promise.resolve(false);

  const conditionalCheck: Promise<boolean> =
    typeof PKC.isConditionalMediationAvailable === "function"
      ? PKC.isConditionalMediationAvailable()
      : Promise.resolve(false);

  const [isPlatformAuthenticatorAvailable, isConditionalMediationAvailable] =
    await Promise.all([
      withTimeout(platformCheck, timeoutMs),
      withTimeout(conditionalCheck, timeoutMs),
    ]);

  const result: BiometricSupport = {
    isApiAvailable,
    isPlatformAuthenticatorAvailable,
    isConditionalMediationAvailable,
    isSecureContext,
  };

  cachedSupport = result;
  cachedTimeoutMs = timeoutMs;
  return result;
}

export async function shouldShowBiometricLoginButton(
  options: GetBiometricSupportOptions = {}
): Promise<boolean> {
  const support = await getBiometricSupport(options);
  return support.isApiAvailable && support.isPlatformAuthenticatorAvailable;
}

export function clearBiometricSupportCache(): void {
  cachedSupport = null;
  cachedTimeoutMs = null;
}