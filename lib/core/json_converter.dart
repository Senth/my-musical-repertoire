import 'dart:convert';

class Json {
  static Map<String, dynamic>? decode(String jsonString) {
    return json.decode(jsonString, reviver: (key, value) {
      if (value is String) {
        // DateTime
        final date = DateTime.tryParse(value);
        if (date != null) {
          return date;
        }
      }
      return value;
    });
  }

  static String encode(Map<String, dynamic> jsonMap) {
    return json.encode(jsonMap, toEncodable: (value) {
      // DateTime
      if (value is DateTime) {
        return value.toIso8601String();
      }
      return value;
    });
  }
}
