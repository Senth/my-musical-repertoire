# My Musical Repertoire — Implementation Plan

## Background & Context

This is a **piano/instrument practice app** that helps musicians decide what to practice. The core problem: "I often don't know what I should practice, and I want the app to help me pick."

### Key Decisions Made

- **Previous attempt**: Flutter — didn't like the developer experience
- **New stack**: Expo + React Native + NativeWind (Tailwind CSS) + Firebase + TypeScript
- **Why Expo over React + Vite + Capacitor**: Expo supports a web-first workflow (`npx expo start --web`) while providing true native mobile components. This avoids a costly migration later (60-70% UI rewrite) if we started with standard React web and later wanted native mobile.
- **Why Firebase**: Developer is already familiar with Firebase. Firebase offers excellent offline support (built-in Firestore offline persistence), real-time sync, and a mature ecosystem. The existing Flutter project already uses Firebase.
- **Development approach**: Solo developer with heavy Copilot/AI assistance

### App Requirements

- **Users**: Multi-user with accounts and authentication
- **Data**: Practice pieces (with PDF sheet music), practice sessions, practice plans
- **Offline**: Must work offline (practicing without wifi) — Firestore's built-in offline persistence handles this
- **File uploads**: PDF/sheet music uploads to Firebase Cloud Storage
- **UI complexity**: Starts simple (lists, cards, buttons), grows to include timers, animations, and eventually PDF annotations
- **Mobile look**: Should look like a native iOS/Android app (platform conventions)
- **Push notifications**: Not needed
- **App store**: Maybe eventually (Android first, iOS later)
- **Platform**: Android primarily (developer's device), web-first for development

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | React Native (via Expo SDK 55+) | Universal: web + iOS + Android |
| **Routing** | Expo Router v4+ | File-based, works on web and mobile |
| **Styling** | NativeWind (Tailwind CSS) | Same Tailwind utility classes |
| **UI Components** | React Native Paper or Tamagui | Cross-platform native-feeling UI |
| **State management** | TanStack Query + Zustand | Server state + client state |
| **Auth** | Firebase Authentication | Email + social login, familiar API |
| **Database** | Cloud Firestore | NoSQL with built-in offline persistence & real-time sync |
| **File storage** | Firebase Cloud Storage | PDF/sheet music uploads |
| **Build/deploy** | EAS Build + EAS Submit | Cloud builds for iOS/Android |
| **Testing** | Jest + React Native Testing Library | Expo's default test setup |
| **Language** | TypeScript | Type safety, better AI completions |

## Web-First Development Workflow

Expo fully supports developing and testing entirely in the browser:

1. Run `npx expo start --web` — app opens in your browser
2. Develop, debug, and test entirely in the browser
3. Use Chrome DevTools, React DevTools — just like standard React web dev
4. File-based routing (`app/` directory) works identically on web and mobile
5. When ready for mobile: press `a` for Android emulator or scan QR code with Expo Go
6. Platform-specific code uses `Component.web.tsx` / `Component.native.tsx` file splits

**You don't need an Android emulator or phone until Phase 6 (Mobile Polish).**

### React Native Cheat Sheet (for web React devs)

| Web (HTML) | React Native | Notes |
|------------|-------------|-------|
| `<div>` | `<View>` | Generic container |
| `<p>`, `<span>` | `<Text>` | All text must be in `<Text>` |
| `<button>` | `<Pressable>` | Touchable element |
| `<input>` | `<TextInput>` | Text input field |
| `<img>` | `<Image>` | Image component |
| scrollable `<div>` | `<ScrollView>` | Scrollable container |
| virtualized list | `<FlatList>` | For long lists (performant) |

Tailwind classes are the same via NativeWind: `<View className="flex-1 p-4 bg-white">`.

## Implementation Phases

### Phase 1: Project Setup & Auth

- [x] Scaffold Expo project with Expo Router + TypeScript
- [x] Configure NativeWind (Tailwind CSS)
- [x] Set up Firebase project (auth, Firestore, storage)
- [x] Implement login/signup (email + social via Firebase Auth)
- [x] Basic layout shell (tabs, header) — test on web only

### Phase 2: Core Data Model & Practice Pieces

- [x] Design Firestore data model (collections: pieces)
- [x] Set up Firestore security rules
- [ ] Build CRUD UI for managing practice pieces
  - [x] Create piece (add-piece screen)
  - [x] Read / list pieces (pieces screen + overview)
  - [ ] Edit piece (title, composer)
  - [ ] Delete piece
- [ ] PDF upload and viewing for sheet music (Firebase Cloud Storage)
  - [ ] Upload PDF to Cloud Storage
  - [ ] View PDF in-app
- [ ] Enable Firestore offline persistence

### Phase 3: Practice Session Tracking

- [ ] Countdown practice timer (set duration, counts down, then opens log form)
- [ ] Session logging
  - [x] Log practice date
  - [x] Technical mistake rating
  - [x] Memory mistake rating
  - [ ] Notes field (free text)
- [ ] Before/after comparison after saving
  - [x] Comparison screen component
- [ ] Practice history screen (list of past sessions per piece)
- [ ] Basic "what to practice" recommendation logic
  - [x] Surface unpracticed pieces first
  - [x] Sort by highest mistake score

### Phase 4: Smart Practice Suggestions

- [ ] Algorithm to suggest what to practice based on:
  - [ ] Time since last practice
  - [ ] Difficulty level and mastery progress
  - [ ] User-defined goals and priorities
- [ ] Dashboard with practice overview and suggestions

### Phase 5: Offline Polish

- [ ] Verify Firestore offline persistence works across all features
- [ ] Cache PDFs locally for offline sheet music viewing
- [ ] Handle edge cases (conflict resolution, stale data indicators)
- [ ] Offline-first UX patterns (optimistic updates, sync indicators)

### Phase 6: Mobile Polish

- [ ] Test on Android device/emulator
- [ ] Platform-specific UI tweaks (`.native.tsx` overrides where needed)
- [ ] EAS Build for Android APK/AAB
- [ ] Optional Google Play Store publish

### Phase 7: Advanced Features (Future)

- [ ] PDF annotation support
- [ ] Practice reminders/scheduling
- [ ] Progress tracking with charts
- [ ] iOS support via EAS Build
- [ ] Countdown timer with suggested duration based on time since last practiced

## Architecture Notes

- **Firestore offline persistence**: Firestore has built-in offline support — data is cached locally and synced automatically when connectivity returns. This is a major advantage over manual sync solutions.
- **Incremental complexity**: Start with simple lists and cards. Add animations, timers, and PDF features progressively.
- **Platform splits**: When mobile needs differ from web, use `Component.web.tsx` / `Component.native.tsx` — Expo auto-picks the right one.
- **Existing Flutter code**: This repo contains a previous Flutter implementation. The Expo rewrite will replace it entirely. Reference the existing code for feature/data model inspiration.
- **Firebase project**: This repo already has Firebase config (`.firebaserc`, `firebase.json`, `firestore.rules`). Reuse the existing Firebase project and Firestore rules as a starting point.
