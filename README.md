# My Musical Repertoire

My Musical Repertoire helps you decide what you should practice on next so that you can remember all the pieces you've learned with minimal effort.

## Tech Stack

- **Framework**: React Native (via Expo SDK 54+)
- **Routing**: Expo Router (file-based)
- **Styling**: NativeWind v5 (Tailwind CSS v4) + React Native Paper (Material Design)
- **Auth & Database**: Firebase (JS SDK)
- **i18n**: i18next + expo-localization
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn (`npm install -g yarn`)
- Firebase CLI (`npm install -g firebase-tools`)

### Setup

```bash
# Install dependencies
yarn install

# Copy env file and fill in your Firebase config
cp .env.example .env

# Start the development server (web)
yarn web
```

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Email/Password and Google sign-in in Authentication
3. Create a Firestore database
4. Add a Web app and copy the config values to your `.env` file

### Running with Firebase Emulators

```bash
firebase emulators:start
yarn web
```

## Project Structure

```
app/              # Expo Router pages (file-based routing)
  (auth)/         # Unauthenticated routes (login)
  (app)/(tabs)/   # Authenticated routes (repertoire)
components/       # Reusable components
config/           # Firebase and app configuration
contexts/         # React contexts (auth)
i18n/             # Internationalization
assets/           # Images, fonts, etc.
```
