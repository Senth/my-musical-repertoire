import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'core/hive_gateway.dart';
import 'Pieces/piece_list.dart';

import 'AppLocalizations.dart';

class App extends StatelessWidget {
  /// Initialize things that needs to happen before creating the app
  static init() {
    HiveGateway.init();
  }

  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Title',
      theme: ThemeData(primarySwatch: Colors.blue),
      supportedLocales: [
        Locale('en', 'US'),
        Locale('sv', 'SE'),
      ],
      localizationsDelegates: [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate
      ],
      localeResolutionCallback: (locale, supportedLocales) {
        for (var supportedLocale in supportedLocales) {
          if (supportedLocale.languageCode == locale.languageCode && supportedLocale.countryCode == locale.countryCode) {
            return supportedLocale;
          }
        }
        return supportedLocales.first;
      },
      home: PieceList(),
    );
  }
}
