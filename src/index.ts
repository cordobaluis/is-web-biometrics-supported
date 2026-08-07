/**
 * Resuelve si el navegador puede mostrar de forma segura un botón de
 * autenticación biométrica (Face ID, Touch ID, Windows Hello, huella
 * en Android) usando la Web Authentication API (WebAuthn).
 *
 * No maneja contraseñas, tokens ni sesiones — solo responde la pregunta
 * de UI: ¿muestro el botón o lo oculto?
 */

/** Resultado de la comprobación de soporte biométrico. */
export interface BiometricSupport {
  /** El navegador implementa la Credential Management API base. */
  isApiAvailable: boolean;
  /** El dispositivo tiene un autenticador de plataforma (biometría/PIN) disponible ahora mismo. */
  isPlatformAuthenticatorAvailable: boolean;
  /** El navegador soporta el flujo condicional (autocompletado biométrico en inputs). */
  isConditionalMediationAvailable: boolean;
  /**
   * true si el documento se sirve en un contexto seguro (HTTPS o localhost).
   * WebAuthn requiere contexto seguro; si es false, isApiAvailable y las
   * demás banderas serán false aunque el navegador soporte la API en teoría.
   */
  isSecureContext: boolean;
}

/** Opciones para getBiometricSupport(). */
export interface GetBiometricSupportOptions {
  /**
   * Milisegundos máximos a esperar por cada comprobación nativa antes de
   * asumir "no disponible". Protege contra navegadores o políticas
   * corporativas donde la consulta al hardware se cuelga indefinidamente.
   * @default 2500
   */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2500;

let cachedSupport: BiometricSupport | null = null;
let cachedTimeoutMs: number | null = null;

/**
 * Comprobación rápida y síncrona: ¿existe la API en este navegador?
 * Úsala quirúrgicamente para decisiones de renderizado inmediato (SSR-safe).
 */
export function isWebAuthnApiAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function"
  );
}

/**
 * Envuelve una promesa nativa con un timeout de seguridad. Si el timeout
 * se cumple primero, resuelve `false` en vez de rechazar: una librería de
 * "¿muestro el botón?" nunca debe forzar al consumidor a manejar errores
 * no capturados solo por un hardware lento o bloqueado.
 */
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

/**
 * Comprobación completa y asíncrona: responde las preguntas que importan
 * para decidir si se muestra el botón de login biométrico.
 *
 * El resultado se cachea en memoria tras la primera resolución exitosa,
 * porque consultar al hardware repetidamente (ej. desde varios componentes
 * de React en la misma sesión) es costoso y el soporte del dispositivo no
 * cambia durante la vida de la página. Si cambias timeoutMs entre llamadas,
 * la caché se invalida y se vuelve a consultar.
 */
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
      "[is-web-biometrics-supported] Este documento no está en un contexto seguro (HTTPS o localhost). " +
        "WebAuthn no funcionará aunque el navegador lo soporte técnicamente. " +
        "Sirve tu app por HTTPS para habilitar la biometría."
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

/**
 * Atajo directo: ¿debo mostrar el botón "Iniciar con Face ID / Touch ID / Windows Hello"?
 * Es la función que el 90% de la gente va a usar.
 */
export async function shouldShowBiometricLoginButton(
  options: GetBiometricSupportOptions = {}
): Promise<boolean> {
  const support = await getBiometricSupport(options);
  return support.isApiAvailable && support.isPlatformAuthenticatorAvailable;
}

/**
 * Limpia la caché interna del resultado de soporte biométrico.
 * Útil principalmente en tests, donde cada caso necesita partir de cero.
 */
export function clearBiometricSupportCache(): void {
  cachedSupport = null;
  cachedTimeoutMs = null;
}