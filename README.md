# Lumyo Mobile

The Lumyo mobile client — an [Expo](https://expo.dev/) / React Native app for organizing notes into categories, browsing summaries, and chatting with an AI assistant over your own sources.

## Tech Stack

- **Expo** `~54` + **React Native** `0.81` (React `19`)
- **TypeScript**
- **React Navigation** — native stack + bottom tabs
- **expo-secure-store** — secure JWT storage
- **lucide-react-native** — icons
- **react-native-markdown-display** — rendering chat/summary markdown
- Fonts: Inter & Space Grotesk (`@expo-google-fonts`)

## Prerequisites

- **Node.js 22.16.0** (see `.tool-versions` — use `asdf`/`nvm`)
- The [Expo Go](https://expo.dev/go) app on a device, or an iOS Simulator / Android Emulator
- A running instance of the Lumyo backend API

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy the example env file and point it at your backend:

   ```bash
   cp .env.example .env
   ```

   ```bash
   # .env
   EXPO_PUBLIC_API_URL=http://localhost:3000
   ```

   > **Note:** When testing on a physical device, `localhost` won't resolve to your dev machine. Use your machine's LAN IP instead, e.g. `http://192.168.1.10:3000`.
   >
   > Variables prefixed with `EXPO_PUBLIC_` are inlined into the client bundle at build time, so they are **not** secret. Never put real secrets here.

3. **Start the dev server**

   ```bash
   npm start
   ```

   Then press `i` (iOS), `a` (Android), or `w` (web), or scan the QR code with Expo Go.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run ios` | Start and open in the iOS Simulator |
| `npm run android` | Start and open in the Android Emulator |
| `npm run web` | Start and open in the browser |

## Project Structure

```
src/
├── components/      # Shared UI components
├── context/         # AuthContext (auth state + session)
├── navigation/      # Navigators, tab bar, route types
├── screens/         # Sign in/up, Home, Categories, Notes, Chat, etc.
├── services/        # API client + feature services (auth, categories, notes, chat, summaries)
└── theme/           # Light and dark palettes, fonts, radii, ThemeProvider
```

Navigation is gated on auth state in `src/navigation/index.tsx`: unauthenticated users see the **Auth** stack; authenticated users land in the bottom-tab app (**Home**, **Categories**, **Notes**, **Chat**).

## Theming

The app has a light and a dark palette with the same token names, taken from `brand-identity/DESIGN.md`. Both live in `src/theme/index.ts`, which holds plain constants only, so tests can load it in Node.

`ThemeProvider` in `src/theme/ThemeContext.tsx` picks the palette. The choice is set in **Settings → Appearance** (System, Light or Dark) and saved with `expo-secure-store`, or `localStorage` on web. `app.json` sets `userInterfaceStyle` to `automatic`, which System needs to follow the device.

In a component, read colors through the hook and build styles from a module-level factory:

```tsx
const { colors } = useTheme();
const styles = useStyles(makeStyles);

const makeStyles = (colors: Colors) => StyleSheet.create({ ... });
```

Shared pieces (headers, buttons, fields, empty states, citation chips) are in `src/components/ui.tsx`. The logo is in `src/components/Logo.tsx`, drawn from the vector files in `logos/final/svg`.

## Dictation

The note editor has a microphone button in the footer and in the bar above the keyboard. It records with `expo-audio` (mono m4a on iOS and Android, the browser's own format on web), uploads to `POST /transcriptions` and adds the text where the cursor was, or at the end of the note if no cursor was placed. Recordings stop on their own after 10 minutes.

The server picks the transcription model, so changing it needs no app release (see `TRANSCRIPTION_MODELS` in the server README). The microphone permission text is set in `app.json` under the `expo-audio` plugin.

## Authentication

The API client (`src/services/api.ts`) attaches a `Bearer` token to authenticated requests and reads new tokens from the `Authorization` response header on sign in/up. Tokens are persisted with `expo-secure-store` — never in plain storage.

## Environment Variables

| Variable | Description |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Base URL of the Lumyo backend API |

## Building for Production

This project uses Expo. For production builds, set `EXPO_PUBLIC_API_URL` to your public API URL (it ships in the bundle) and build with [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --platform ios
npx eas build --platform android
```
