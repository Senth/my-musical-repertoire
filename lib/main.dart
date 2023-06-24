import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:my_musical_repertoire/app_localitazations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:my_musical_repertoire/firebase_options.dart';
import 'package:my_musical_repertoire/screens/login_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
        future: Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform),
        builder: (context, snapshot) {
          // Errors
          if (snapshot.hasError) {
            debugPrint(snapshot.error.toString());
            return mainApp(context, Scaffold(body: Center(child: Text(translate(context, "app.error.firebase")))));
          }

          // Done
          if (snapshot.connectionState == ConnectionState.done) {
            // Check if user already is logged in using Firebase Auth
            if (FirebaseAuth.instance.currentUser != null) {
              return mainApp(context, const Scaffold(body: Center(child: Text("User is logged in"))));
            } else {
              return mainApp(context, const LoginPage());
            }
          }

          // Loading
          return mainApp(context, const Scaffold(body: Center(child: CircularProgressIndicator())));
        }
    );
  }
}

MaterialApp mainApp(BuildContext context, Widget home) {
  return MaterialApp(
      title: translate(context, 'app.name'),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.purple),
        useMaterial3: true,
      ),
      home: home,
      supportedLocales: const [
        Locale('en', 'US'),
      ],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      localeResolutionCallback: (locale, supportedLocales) {
        for (Locale supportedLocale in supportedLocales) {
          if (supportedLocale.languageCode == locale!.languageCode &&
              supportedLocale.countryCode == locale.countryCode) {
            return supportedLocale;
          }
        }
        return supportedLocales.first;
      }
  );
}