import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/json_converter.dart';
import 'package:my_musical_repertoire/features/piece/data/models/piece_model.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

import '../../../../fixtures/fixture_reader.dart';

void main() {
  group("PieceModel (#model #cold) ->", () {
    PieceModel pieceFull;
    PieceModel pieceMissingLastPractice;

    setUp(() {
      pieceFull = PieceModel(
        id: "1",
        title: "Test Piece",
        composer: "Test Composer",
        lastPracticed: DateTime.parse("2020-01-01T16:17:15.133"),
      );
      pieceMissingLastPractice = PieceModel(
        id: "1",
        title: "Test Piece",
        composer: "Test Composer",
      );
    });

    test("fromEntity() should be equal the entity when creating from an entity", () {
      final testData = [
        {
          "input": PieceEntity(
            id: "1",
            title: "title",
            composer: "composer",
            lastPracticed: DateTime.parse("2020-01-01T16:17:15.133"),
          ),
          "expected": PieceModel(
            id: "1",
            title: "title",
            composer: "composer",
            lastPracticed: DateTime.parse("2020-01-01T16:17:15.133"),
          ),
        },
      ];

      for (final data in testData) {
        PieceEntity input = data["input"];
        PieceModel expected = data["expected"];
        PieceModel result = PieceModel.fromEntity(input);
        expect(result, expected);
      }
    });

    group("fromMap()", () {
      test("should return a valid model when the map has all fields", () async {
        final Map<String, dynamic> jsonMap = Json.decode(fixture('piece.json'));
        final result = PieceModel.fromMap(jsonMap);
        expect(result, pieceFull);
      });

      test("should return a valid model when the map is missing the lastPracticed field", () async {
        final Map<String, dynamic> jsonMap = Json.decode(fixture('piece_without_lastPractice.json'));
        final result = PieceModel.fromMap(jsonMap);
        expect(result, pieceMissingLastPractice);
      });
    });

    group("toMap()", () {
      test("should return a map with all the fields", () {
        final expectedMap = {
          "id": pieceFull.id,
          "title": pieceFull.title,
          "composer": pieceFull.composer,
          "lastPracticed": pieceFull.lastPracticed,
        };
        final result = pieceFull.toMap();
        expect(result, expectedMap);
      });

      test("should return a map with all fields, lastpractice set to null", () {
        final expectedMap = {
          "id": pieceMissingLastPractice.id,
          "title": pieceMissingLastPractice.title,
          "composer": pieceMissingLastPractice.composer,
          "lastPracticed": null,
        };
        final result = pieceMissingLastPractice.toMap();
        expect(result, expectedMap);
      });
    });

    test("toEntity() should return valid entity when called", () {
      final testData = [
        {
          "input": PieceModel(
            id: "1",
            title: "name",
            composer: "composer",
            lastPracticed: DateTime.parse("2020-01-01T16:17:15.133"),
          ),
          "expected": PieceEntity(
            id: "1",
            title: "name",
            composer: "composer",
            lastPracticed: DateTime.parse("2020-01-01T16:17:15.133"),
          ),
        },
      ];

      for (final data in testData) {
        PieceModel input = data["input"];
        final expected = data["expected"];
        final result = input.toEntity();
        expect(result, expected);
      }
    });
  });
}
