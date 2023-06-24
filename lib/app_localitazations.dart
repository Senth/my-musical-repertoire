import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Helper function for translating
/// @param context the context
/// @param key the key of the translation
String translate(BuildContext context, String key) {
  AppLocalizations? localizations = AppLocalizations.of(context);
  if (localizations == null) {
    return key;
  }
  return localizations.translate(key);
}

class AppLocalizations {
  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();
  final Locale locale;
  late Map<String, String> _localizedStrings;

  AppLocalizations(this.locale);

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  String translate(String key) {
    var value = _localizedStrings[key];
    if (value == null) {
      return key;
    }

    return value;
  }

  Future<void> load() async {
    String jsonString = await rootBundle.loadString('lang/${locale.languageCode}_${locale.countryCode}.json');
    Map<String, dynamic> jsonMap = json.decode(jsonString);

    _localizedStrings = jsonMap.map((key, value) {
      return MapEntry(key, value.toString());
    });
  }
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return ['en_US', 'sv_SE'].contains('${locale.languageCode}_${locale.countryCode}');
  }

  @override
  Future<AppLocalizations> load(Locale locale) async {
    AppLocalizations localizations = AppLocalizations(locale);
    await localizations.load();
    return localizations;
  }

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppLocalizations> old) => false;
}