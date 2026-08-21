# AHG Unlocker — License Activation System

This document describes how license activation works in AHG Unlocker: how keys are
validated, how a machine is fingerprinted and bound to a key, where state lives, and
how every piece communicates across the Electron main/renderer boundary.

> **Security note:** The real GitHub token, Gist ID, and Discord secrets live in
> `config/secrets.json` and are intentionally **redacted** in this document. Never
> commit those values to documentation or version control.

---

## 1. Overview

AHG Unlocker uses a **centralized, cloud-backed licensing model** with a
**one-license-per-machine** binding:

- A **GitHub Gist** acts as the license registry (`license_keys.json`).
- Each license key maps to either `"pending"` (unclaimed) or a **machine ID** (claimed).
- On activation, the app writes the current machine ID into the Gist, "claiming" the key.
- The activation result is cached locally so the app works largely offline afterward.
- The seller can **revoke** a key by removing it from the Gist; the next online check
  invalidates the local license.

There is a **single binary gate** — `isActivated: true | false`. There is **no trial
tier, no time limit, and no per-feature gating**. Unlicensed users only see the splash
screen and the activation modal; licensed users get the full app.

| Aspect | Detail |
|--------|--------|
| Backend / registry | GitHub Gist API (`license_keys.json`) |
| License key format | Numeric string (e.g. `556909806582235177`) |
| Machine binding | Windows hardware UUID, or generated `AHG-{32 hex}` fallback |
| Local storage | `%APPDATA%\AHG Unlocker\ahg_license.json` + `ahg_machine_id.json` |
| Cryptography | HTTPS transport only; no signature verification of registry data |
| Offline capable | Partial — local validation works; revocation needs network |
| Dev bypass | Yes — unpackaged / `--dev` / `NODE_ENV=development` |

---

## 2. Component Map

| Layer | File | Role |
|-------|------|------|
| Main process | `electron/handlers/license.cjs` | All license logic + IPC handlers |
| Main process | `electron/handlers/deferred-loader.cjs` | Registers license handlers after window creation |
| Main process | `electron/utils/secrets.cjs` | Loads `secrets.json` from fallback paths |
| Bridge | `electron/preload.cjs` | Exposes IPC to renderer via `contextBridge` |
| Bridge | `src/bridge.ts` | Typed wrappers around the preload API |
| Renderer (logic) | `src/hooks/useLicense.ts` | Startup check, runtime listeners, toasts |
| Renderer (state) | `src/store/uiStore.ts` | `activationOpen`, `isActivated` |
| Renderer (UI) | `src/components/ActivationModal.tsx` | Key entry + success/error UX |
| Renderer (gate) | `src/App.tsx` | Shows main app only when activated |
| Types | `src/vite-env.d.ts` | `ElectronAPI` license method signatures |
| Config | `config/secrets.json` (+ `secrets.template.json`) | Gist ID, GitHub token, Discord secrets |

---

## 3. Storage

### Local files (`%APPDATA%\AHG Unlocker\`)

Paths are derived from `app.getPath('userData')` in `electron/handlers/license.cjs`:

```js
const LICENSE_FILE    = path.join(app.getPath('userData'), 'ahg_license.json');
const MACHINE_ID_FILE = path.join(app.getPath('userData'), 'ahg_machine_id.json');
```

**`ahg_machine_id.json`** — the stable machine fingerprint:

```json
{
  "machineId": "AHG-85f803cb92b78bc392dac0ce97bd90f9",
  "source": "generated",
  "created": "2026-06-25T14:06:08.472Z"
}
```

**`ahg_license.json`** — the cached activation record:

```json
{
  "licenseKey": "556909806582235177",
  "machineId": "AHG-85f803cb92b78bc392dac0ce97bd90f9",
  "activated": true,
  "date": "2026-06-25T18:59:56.072Z",
  "integrityHash": "-eliglq",
  "version": "1.0.0"
}
```

> Both files are **plain JSON, unencrypted at rest**. Any process with access to the
> user's AppData can read or delete them.

### Remote registry (GitHub Gist)

- Endpoint: `https://api.github.com/gists/{licenseGistId}`
- File within the Gist: `license_keys.json`
- Shape: `{ "<LICENSE_KEY>": "<machineId | 'pending'>" }`
- Authenticated with a Personal Access Token (`githubToken`) sent in the
  `Authorization: token …` header. Reads are HTTPS `GET`; claims are HTTPS `PATCH`.

---

## 4. Machine ID / Hardware Fingerprinting

`getMachineId()` in `electron/handlers/license.cjs` resolves an ID using a three-step
priority chain, then persists the result:

1. **Saved file** — if `ahg_machine_id.json` exists and is valid, reuse it (ensures
   stability across runs).
2. **Windows hardware UUID** — `readHardwareUuid()`, which probes in order:
   - `powershell -NoProfile -NonInteractive -Command "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"`
   - `wmic csproduct get uuid` (legacy fallback)

   Results are validated against a `BOGUS_UUIDS` denylist, because some OEMs report a
   single placeholder UUID across every unit they ship — binding to one of those would
   let every such machine share a key.
3. **Generated fallback** — `'AHG-' + crypto.randomBytes(16).toString('hex')` when no
   hardware UUID can be read.

> **Why CIM comes first:** `wmic` was **removed in Windows 11 24H2+**. When it was the
> only probe, every modern machine silently fell through to the random `AHG-…` id.
> That id lives only in AppData, so clearing AppData or reinstalling produced a *new*
> machine identity and locked the customer out with "already activated on another
> device" until staff ran `/refresh`. This is why the live registry is full of
> `AHG-…` values rather than hardware UUIDs.

The `source` field in the saved file records which path produced the ID
(`"hardware"` or `"generated"`). **Existing installs keep their stored id** — step 1
runs first, so this change only affects fresh activations.

---

## 5. Activation Flow

### 5.1 Startup check — `check-license`

`electron/handlers/license.cjs`:

1. **Dev bypass** — returns `{ activated: true }` immediately if unpackaged, `--dev`, or
   `NODE_ENV=development`.
2. Load local `ahg_license.json`. If missing / not activated / no machineId →
   `{ activated: false }`.
3. **Online revocation check** — fetch the Gist. `fetchLicenses()` returns the registry
   object on success and **`null`** when it could not be read; the distinction is
   load-bearing:
   - Key still present and bound to `'pending'` or this machine → validated.
   - Key absent from a **successfully read** registry → revoked; local file deleted.
   - Read failed (`null`: offline, HTTP 4xx/5xx, rate limited, malformed body) → fall
     back to **local** validation. **Never revokes.**

   > Previously `fetchLicenses()` returned `{}` on any error, so every offline start
   > looked like a mass revocation and deleted the paying customer's license file.
   > `electron/handlers/__tests__/license.test.cjs` pins this decision table.
4. Return `{ activated: true, machineId }`, or `{ activated: false, machineMismatch: true }`
   if the machine no longer matches.

### 5.2 Claiming a key — `activate-license`

```js
ipcMain.handle('activate-license', async (event, licenseKey) => {
  const machineId = getMachineId();
  const licenses  = await fetchLicenses();          // GET the Gist
  const key       = licenseKey.trim().toUpperCase();

  if (!licenses[key]) return { success: false, error: 'invalid', message: 'Invalid License Key' };

  const registered = licenses[key];
  if (registered && registered !== 'pending' && registered !== machineId)
    return { success: false, error: 'already_activated', message: 'License Already Activated on Another Device' };

  licenses[key] = machineId;                          // claim it
  const updated = await updateGist(licenses);         // PATCH the Gist
  if (!updated) return { success: false, error: 'network', message: 'Failed to update license' };

  saveLocalLicense(key, machineId);                   // write ahg_license.json
  return { success: true, message: 'Activation Successful!' };
});
```

Order of operations: validate against registry → check machine binding → write machine ID
into the Gist → cache locally.

### 5.3 Re-validation at runtime

`src/hooks/useLicense.ts` subscribes to `onLicenseStateChanged`. If the local license is
deleted or revoked while the app is running, the main process broadcasts
`license-state-changed`, the hook flips `isActivated` to false and reopens the activation
modal.

---

## 6. Deactivation & Revocation

### User deactivation — `deactivate-license`

Deletes the local **license** file and broadcasts a state change to **all** windows. It
does **not** update the Gist, so the key remains claimed remotely (still bound to that
machine ID).

```js
ipcMain.handle('deactivate-license', async () => {
  if (fs.existsSync(LICENSE_FILE)) fs.unlinkSync(LICENSE_FILE);
  // ahg_machine_id.json is deliberately KEPT — see note below
  BrowserWindow.getAllWindows().forEach(w =>
    w.webContents.send('license-state-changed', { activated: false }));
  return { success: true, message: 'License removed.' };
});
```

> **The machine ID is intentionally preserved.** It is the machine's identity, not the
> license. Deleting it changed the fingerprint, so re-entering the *same* key on the
> *same* PC was rejected as "License Already Activated on Another Device" — deactivation
> was a one-way trip that required staff `/refresh` to undo.

### Seller revocation

The seller removes the key from the Gist's `license_keys.json`. On the next online
`check-license`, the key is absent → the local license file is deleted and the user is
prompted to re-activate.

---

## 7. IPC Channels

### Request/response (`ipcRenderer.invoke` ↔ `ipcMain.handle`)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `check-license` | Renderer → Main | Validate license at startup |
| `activate-license` | Renderer → Main | Submit a key, claim it in the registry |
| `deactivate-license` | Renderer → Main | Remove the local license |
| `get-support-link` | Renderer → Main | Return the Discord support invite |

### One-way broadcast

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `license-state-changed` | Main → Renderer | Notify of revocation / deletion |

Handlers are registered in `electron/handlers/license.cjs` and wired up from
`electron/handlers/deferred-loader.cjs` **after** the main window is created (deferred to
keep startup fast).

### Preload exposure (`electron/preload.cjs`)

```js
activateLicense:      (licenseKey) => ipcRenderer.invoke('activate-license', licenseKey),
checkLicense:         ()           => ipcRenderer.invoke('check-license'),
deactivateLicense:    ()           => ipcRenderer.invoke('deactivate-license'),
onLicenseStateChanged:(cb)         => ipcRenderer.on('license-state-changed', (_e, d) => cb(d)),
getSupportLink:       ()           => ipcRenderer.invoke('get-support-link'),
```

### Renderer types (`src/vite-env.d.ts`)

```ts
interface ElectronAPI {
  checkLicense?: () => Promise<{ activated: boolean; machineId?: string; integrityFailed?: boolean; machineMismatch?: boolean }>
  activateLicense?: (licenseKey: string) => Promise<{ success: boolean; error?: string; message?: string }>
  deactivateLicense?: () => Promise<{ success: boolean; message?: string }>
  onLicenseStateChanged?: (cb: (data: { activated: boolean }) => void) => void
  getSupportLink?: () => Promise<string>
}
```

---

## 8. UI — Activation Modal

`src/components/ActivationModal.tsx` (props `{ isOpen, onActivated }`), driven by
`useUIStore` (`activationOpen`, `isActivated`):

- Text input for the key (auto-uppercased) with a paste-from-clipboard button.
- States: `idle | success | error`, with inline error messages from the activation result.
- Success screen: animated checkmark, expanding rings/sparkles, ~2s countdown before the
  main app appears.
- "Meme mode": if the user tries to close without entering a key, a playful prompt appears;
  a skip hint badge fades in after ~3s.
- Discord support button → `get-support-link`, which returns
  `https://discord.gg/{secrets.discordInvite}`. Never hardcode the invite here; the
  previous literal expired and the button led to a dead invite.

The gate in `src/App.tsx`:

```tsx
useEffect(() => {
  if (splashDone && isActivated) setShowMainApp(true)
}, [splashDone, isActivated])
```

---

## 9. Integrity Hash

On activation, `ahg_license.json` stores an `integrityHash` computed from the contents of
`license.cjs` itself via a small **non-cryptographic** hash:

```js
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}
```

This is a tamper-detection signal for large code changes — it is **not** HMAC and provides
no real protection against a determined attacker. A mismatch surfaces as
`integrityFailed: true` and prompts re-activation.

---

## 10. Secrets & Configuration

Loaded by `electron/utils/secrets.cjs`, which checks several fallback paths in order:

1. `app.getPath('userData')/config/secrets.json`
2. `{projectRoot}/config/secrets.json` (dev)
3. `{resourcesPath}/config/secrets.json` (packaged)
4. `{exeDir}/resources/config/secrets.json`

`config/secrets.json` (values **redacted** — see `config/secrets.template.json`):

```json
{
  "licenseGistId":      "<GIST_ID>",
  "githubToken":        "<GITHUB_PERSONAL_ACCESS_TOKEN>",
  "discordClientId":    "<DISCORD_CLIENT_ID>",
  "discordClientSecret":"<DISCORD_CLIENT_SECRET>",
  "discordBotToken":    "<DISCORD_BOT_TOKEN>",
  "discordInvite":      "<INVITE_CODE>"
}
```

### `githubToken` requirements

The token must be issued by **the account that owns the Gist** and carry the **`gist`
scope**. Both halves matter:

- Secret Gists are readable by anyone with the URL, so a wrong-account token still
  **reads** fine — the failure only shows up on write.
- Every write (`PATCH /gists/{id}`) from a non-owner returns **HTTP 404**, surfacing as
  the generic *"Failed to update license"*. Activation is impossible; the Discord bot's
  `/activate`, `/remove`, `/refresh`, and `/clear` fail identically.

Scope it to `gist` and **nothing else**. This token ships inside the packaged app
(`resources/config/secrets.json`) and can be extracted by any customer, so a
broadly-scoped PAT (`repo`, `admin:org`, `delete_repo`, `workflow`) would hand over the
whole account.

Verify a candidate token before shipping it:

```bash
curl -i -H "Authorization: token <TOKEN>" https://api.github.com/user      # check X-OAuth-Scopes: gist
curl -i -X PATCH -H "Authorization: token <TOKEN>" \
     -d '{"description":"AHG License Keys"}' \
     https://api.github.com/gists/<GIST_ID>                                # must be 200, not 404
```

### `discordInvite`

Invite **code** only (no `https://discord.gg/` prefix). Feeds both the in-app support
button (`get-support-link`) and is kept in `secrets.json` so an expired invite can be
replaced without a rebuild. Create it with **no expiry and unlimited uses** — the
previous hardcoded link expired and the support button led nowhere.

---

## 11. Error States

### `activate-license`

| Error code | Message | Cause |
|------------|---------|-------|
| `invalid` | "Please enter a license key" | Blank / non-string input |
| `invalid` | "Invalid License Key" | Key genuinely absent from a **successfully read** Gist |
| `already_activated` | "License Already Activated on Another Device" | Key bound to a different machine |
| `network` | "Could not reach the license server…" | Registry **read** failed — the key is never branded invalid on a failed read |
| `network` | "Failed to update license" | Registry **write** rejected. Check the token: a 404 here means it cannot write this Gist (wrong account or missing `gist` scope). The HTTP status is logged as `[LICENSE] Gist update failed — HTTP …` |

### `check-license`

| Condition | Response |
|-----------|----------|
| No local file | `{ activated: false }` |
| File missing `machineId` | `{ activated: false }` |
| Machine mismatch | `{ activated: false, machineMismatch: true }` |
| Integrity mismatch | `{ integrityFailed: true }` |

Renderer toasts (from `useLicense.ts`): "Activation required", "License invalid on this
device - Re-activate", "Code modified - Re-activation required".

---

## 12. Development Bypass

```js
if (!app.isPackaged || process.argv.includes('--dev') || process.env.NODE_ENV === 'development') {
  return { activated: true };
}
```

Activation is skipped entirely when running from source, with `--dev`, or with
`NODE_ENV=development` — convenient for development, but it means the gate only exists in
packaged builds.

---

## 13. Security Considerations

- **Plain-text local files** — `ahg_license.json` / `ahg_machine_id.json` are unencrypted
  and trivially editable; local validation can be spoofed offline.
- **No signature verification** — the app trusts whatever the Gist returns over HTTPS;
  there is no signed payload.
- **Embedded GitHub token** — the registry write token ships inside the app; anyone who
  extracts it could read/modify the Gist. Treat the token as compromised if the bundle is
  distributed, and prefer a server-side proxy for any future hardening. Keep the token
  **`gist`-scoped only** so the blast radius stays "someone can tamper with the license
  registry" rather than "someone owns the GitHub account".
- **Last-write-wins on the registry** — `updateGist()` PATCHes the whole file, so two
  customers activating in the same second can drop one binding. Rare at current volume;
  fixing it properly needs a server that does a compare-and-set.
- **`integrityHash` is written but never checked** — `saveLocalLicense()` stores it and
  `useLicense.ts` handles an `integrityFailed` flag, but no handler ever sets that flag.
  The branch is currently dead.
- **`simpleHash` is not security** — it only catches accidental/large code changes.
- **Hardware binding helps** but the generated-ID fallback weakens it on machines where
  `wmic` is unavailable.

These trade-offs favor simplicity and are typical for a consumer tool; a hardened design
would move key issuance/verification behind a server that signs responses and never ships
a write-capable token in the client.
