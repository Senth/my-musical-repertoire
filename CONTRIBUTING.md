# Contributing

## Getting Started

After forking and cloning this repository:

1. Install dependencies:
```bash
yarn install
```

2. Set up Firebase (if you don't have an existing project):
```bash
npm install -g firebase-tools
firebase login
firebase projects:list
```

3. Copy the environment file and fill in your Firebase config:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
yarn web
```

5. (Optional) Run with Firebase emulators:
```bash
firebase emulators:start
yarn web
```

## Web-First Development Workflow

Expo supports developing and testing entirely in the browser:

1. Run `yarn web` (`npx expo start --web`) — the app opens in your browser.
2. Develop, debug, and test entirely in the browser (Chrome DevTools, React DevTools).
3. File-based routing (`app/` directory) works identically on web and mobile.
4. When ready for mobile: press `a` for the Android emulator or scan the QR code with Expo Go.
5. Platform-specific code uses `Component.web.tsx` / `Component.native.tsx` file splits.

You don't need an Android emulator or phone until the mobile-polish work.

### React Native Cheat Sheet (for web React devs)

| Web (HTML)         | React Native   | Notes                        |
| ------------------ | -------------- | ---------------------------- |
| `<div>`            | `<View>`       | Generic container            |
| `<p>`, `<span>`    | `<Text>`       | All text must be in `<Text>` |
| `<button>`         | `<Pressable>`  | Touchable element            |
| `<input>`          | `<TextInput>`  | Text input field             |
| `<img>`            | `<Image>`      | Image component              |
| scrollable `<div>` | `<ScrollView>` | Scrollable container         |
| virtualized list   | `<FlatList>`   | For long lists (performant)  |

Tailwind classes are the same via NativeWind: `<View className="flex-1 p-4 bg-white">`.

## Tasks & Planning

- Actionable work lives in **GitHub Issues** + the Kanban board, not in markdown.
  Capture anything (even from your phone) as an issue — it auto-lands in **Backlog**.
- [`TODO.md`](TODO.md) is a generated mirror of the board; regenerate with
  `scripts/sync-todo.sh` (auto-runs on branch checkout). Do not hand-edit it.
- Vision, requirements, decisions, and architecture live in [`docs/PROJECT.md`](docs/PROJECT.md);
  per-feature specs in [`docs/specs/`](docs/specs/).