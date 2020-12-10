import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/json_converter.dart';

void main() {
  group("Json (#helper #cold) ->", () {
    group("DateTime", () {
      final date = DateTime.now();
      final map = {"date": date};
      final jsonString = '{"date":"${date.toIso8601String()}"}';

      // Encode
      test("encode() should convert the DateTime to ISO8601 string when encoding a map to json", () {
        final result = Json.encode(map);
        expect(result, jsonString);
      });

      // Decode
      test("decode() should return a Datetime when a string is equal to Date ISO8601 string", () {
        final result = Json.decode(jsonString);
        expect(result, map);
      });
    });
  });
}
