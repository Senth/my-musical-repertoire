# Contributing

## Getting Started
After forking and cloning this repository, you need to first create a Firebase project if you don't
have it. Then, you need to install the Firebase CLI tools and login to your account:

```bash
npm install -g firebase-tools
firebase login
firebase projects:list
dart pub global activate flutterfire_cl
flutterfire configure --project=<your-firebase-project-id>
```

This should generate all the necessary files you need for starting the app.