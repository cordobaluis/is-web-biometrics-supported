# is-web-biometrics-supported

[![CI](https://github.com/cordobaluis/is-web-biometrics-supported/actions/workflows/ci.yml/badge.svg)](https://github.com/cordobaluis/is-web-biometrics-supported/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/is-web-biometrics-supported.svg)](https://www.npmjs.com/package/is-web-biometrics-supported)
[![npm downloads](https://img.shields.io/npm/dm/is-web-biometrics-supported.svg)](https://www.npmjs.com/package/is-web-biometrics-supported)
[![license](https://img.shields.io/npm/l/is-web-biometrics-supported.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/is-web-biometrics-supported)](https://bundlephobia.com/package/is-web-biometrics-supported)

**One question, answered well:** should you show the user a "Sign in with Face ID / Touch ID / Windows Hello" button, or hide it because their browser or device doesn't support it?

Zero dependencies. Zero security handling. It doesn't touch passwords, tokens, or sessions — that's your backend's job, as it should be. This library only answers the UI question, using the native `PublicKeyCredential` API (part of WebAuthn) that browsers already ship with.

```js
import { shouldShowBiometricLoginButton } from "is-web-biometrics-supported";

if (await shouldShowBiometricLoginButton()) {
  renderBiometricButton();
}
```

---

## Why this exists

Any company implementing biometric login already has its own WebAuthn backend (credential registration, signature verification, all of that). What almost nobody solves well is the step before that, purely on the UI side: **reliably detecting, with a timeout and without blocking the thread, whether it's even worth showing the button in the first place.**

Without this, teams end up copy-pasting the same `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` snippet into every project, without handling:

- Browsers where the hardware check hangs indefinitely
- Insecure contexts (HTTP without TLS) where the API exists but doesn't actually work
- Redundant repeated calls to the hardware from different components
- Server-side rendering environments (Next.js, Nuxt) where `window` doesn't exist

This library solves exactly that, in under 2 KB, with no dependencies.

---

## Installation

```bash
npm install is-web-biometrics-supported
```

```bash
pnpm add is-web-biometrics-supported
```

```bash
yarn add is-web-biometrics-supported
```

Also available with no install step, straight from a CDN:

```html
<script src="https://unpkg.com/is-web-biometrics-supported"></script>
<script>
  isWebBiometricsSupported.getBiometricSupport().then(console.log);
</script>
```

---

## Usage

### The most common case: show or hide a button

```ts
import { shouldShowBiometricLoginButton } from "is-web-biometrics-supported";

const button = document.getElementById("bio-login-btn");
button.hidden = true; // hidden by default while resolving

if (await shouldShowBiometricLoginButton()) {
  button.hidden = false;
}
```

### With React

```tsx
import { useEffect, useState } from "react";
import { shouldShowBiometricLoginButton } from "is-web-biometrics-supported";

function BiometricLoginButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    shouldShowBiometricLoginButton().then(setShow);
  }, []);

  if (!show) return null;

  return <button onClick={loginWithBiometrics}>Sign in with Face ID / Touch ID</button>;
}
```

### Full diagnostic (for debugging or analytics)

```ts
import { getBiometricSupport } from "is-web-biometrics-supported";

const support = await getBiometricSupport();

console.log(support);
// {
//   isApiAvailable: true,
//   isPlatformAuthenticatorAvailable: true,
//   isConditionalMediationAvailable: true,
//   isSecureContext: true
// }
```

### Fast synchronous check (for SSR or initial render)

```ts
import { isWebAuthnApiAvailable } from "is-web-biometrics-supported";

// Doesn't query the hardware, just checks whether the browser implements the API.
// Safe to call on initial render, even before hydration.
if (isWebAuthnApiAvailable()) {
  // the browser supports WebAuthn in general (doesn't guarantee specific biometrics)
}
```

### With a custom timeout

```ts
import { getBiometricSupport } from "is-web-biometrics-supported";

// By default, each native check has 2500ms before assuming "not available".
// Adjust it if your users are on slower hardware or you want a faster response.
const support = await getBiometricSupport({ timeoutMs: 5000 });
```

---

## API

### `shouldShowBiometricLoginButton(options?)`

Direct shortcut for 90% of use cases. Returns `true` only if the API exists, the context is secure (HTTPS), and a platform authenticator is currently available.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `options.timeoutMs` | `number` | `2500` | Max milliseconds per native check before assuming `false`. |

**Returns:** `Promise<boolean>`

---

### `getBiometricSupport(options?)`

Full diagnostic. Useful when you need to know *why* the button can't be shown (for logging, analytics, or helper messages to the user).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `options.timeoutMs` | `number` | `2500` | Max milliseconds per native check before assuming `false`. |

**Returns:** `Promise<BiometricSupport>`

```ts
interface BiometricSupport {
  isApiAvailable: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  isConditionalMediationAvailable: boolean;
  isSecureContext: boolean;
}
```

| Field | Meaning |
|---|---|
| `isApiAvailable` | The browser implements `PublicKeyCredential` **and** the context is secure (HTTPS or `localhost`). |
| `isPlatformAuthenticatorAvailable` | The device has biometrics/PIN configured and available right now. |
| `isConditionalMediationAvailable` | The browser supports biometric autofill on inputs (conditional passkeys). |
| `isSecureContext` | `true` if the document is served over HTTPS or `localhost`. WebAuthn won't work without this. |

The result is **automatically cached** after the first successful resolution, so it doesn't re-query the hardware from multiple components within the same session.

---

### `isWebAuthnApiAvailable()`

Synchronous, immediate check: does `PublicKeyCredential` exist in this browser? Doesn't query hardware, isn't async, safe for SSR.

**Returns:** `boolean`

---

### `clearBiometricSupportCache()`

Clears the internal cache. Mainly intended for tests.

**Returns:** `void`

---

## SSR compatibility (Next.js, Nuxt, Remix, etc.)

The library automatically detects when `window` doesn't exist and responds safely without throwing errors at build time or in Server Components:

```ts
// In a Server Component or during build, this does NOT throw:
import { isWebAuthnApiAvailable } from "is-web-biometrics-supported";

isWebAuthnApiAvailable(); // false, no errors
```

Covered by [automated tests running in a pure Node environment](./src/ssr.test.ts).

---

## Why not just use the native API directly?

You can, of course — it's just `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`. This library exists because that single line, in production, needs:

- A safety timeout (some browsers/corporate policies hang the check indefinitely)
- Explicit secure-context verification, with a clear console warning when it fails
- Caching to avoid unnecessary repeated hardware queries
- Verified SSR compatibility

All of that, already solved and tested, in under 2 KB.

---

## Development

```bash
git clone https://github.com/cordobaluis/is-web-biometrics-supported.git
cd is-web-biometrics-supported
npm install
npm run test
npm run build
```

## License

[MIT](./LICENSE) © [Luis Cordoba](https://github.com/cordobaluis)