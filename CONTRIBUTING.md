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