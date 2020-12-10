import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/json_converter.dart';
import 'package:my_musical_repertoire/features/piece/data/models/piece_model.dart';

import '../../../../fixtures/fixture_reader.dart';

void main() {
  group("PieceModel (#model #cold) ->", () {
    PieceModel pieceFull;
    PieceModel pieceMissingLastPractice;

    setUp(() {
      pieceFull = PieceModel(id: "1", name: "Test Piece", lastPracticed: DateTime.parse("2020-01-01T16:17:15.133"));
      pieceMissingLastPractice = PieceModel(id: "1", name: "Test Piece");
    });

    test("fromEntity() should be equal the entity when creating from an entity", () {
      final result = PieceModel.fromEntity(pieceFull);
      expect(result, pieceFull);
    });

    group("fromJson()", () {
      test("should return a valid model when JSON has all fields", () async {
        final Map<String, dynamic> jsonMap = Json.decode(fixture('piece.json'));
        final result = PieceModel.fromJson(jsonMap);
        expect(result, pieceFull);
      });

      test("should return a valid model when JSON is missing the lastPracticed field", () async {
        final Map<String, dynamic> jsonMap = Json.decode(fixture('piece_without_lastPractice.json'));
        final result = PieceModel.fromJson(jsonMap);
        expect(result, pieceMissingLastPractice);
      });
    });

    group("toJson()", () {
      test("should return a JSON map with all the fields", () {
        final expectedMap = {
          "id": pieceFull.id,
          "name": pieceFull.name,
          "lastPracticed": pieceFull.lastPracticed,
        };
        final result = pieceFull.toJson();
        expect(result, expectedMap);
      });

      test("should return a JSON map with all fields excluding last practiced", () {
        final expectedMap = {
          "id": pieceMissingLastPractice.id,
          "name": pieceMissingLastPractice.name,
          "lastPracticed": pieceMissingLastPractice.lastPracticed,
        };
        final result = pieceMissingLastPractice.toJson();
        expect(result, expectedMap);
      });
    });
  });
}
