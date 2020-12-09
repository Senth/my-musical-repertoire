import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:faker/faker.dart';
import 'package:my_musical_repertoire/features/piece/data/models/piece_model.dart';

import '../../../../fixtures/fixture_reader.dart';

const _faker = Faker();

void main() {
  group("PieceModel (#model #cold) ->", () {
    PieceModel pieceFull;
    PieceModel pieceMissingLastPractice;

    setUp(() {
      pieceFull =
          PieceModel(id: "1", name: "Test Piece", lastPracticed: DateTime.fromMillisecondsSinceEpoch(1546300800 * 1000));
      pieceMissingLastPractice = PieceModel(id: "1", name: "Test Piece");
    });

    group("fromJson() should", () {
      test("return a valid model when JSON has all fields", () async {
        final Map<String, dynamic> jsonMap = json.decode(fixture('piece.json'));
        final result = PieceModel.fromJson(jsonMap);
        expect(result, pieceFull);
      });

      test("return a valid model when JSON is missing the lastPracticed field", () async {
        final Map<String, dynamic> jsonMap = json.decode(fixture('piece_without_lastPractice.json'));
        final result = PieceModel.fromJson(jsonMap);
        expect(result, pieceMissingLastPractice);
      });
    });

    group("toJson() should", () {
      test("return a JSON map with all the fields", () {
        final expectedMap = {
          "id": pieceFull.id,
          "name": pieceFull.name,
          "lastPracticed": pieceFull.lastPracticed.millisecondsSinceEpoch / 1000,
        };
        final result = pieceFull.toJson();
        expect(result, expectedMap);
      });

      test("return a JSON map with all fields excluding last practiced", () {
        final expectedMap = {
          "id": pieceMissingLastPractice.id,
          "name": pieceMissingLastPractice.name,
        };
        final result = pieceMissingLastPractice.toJson();
        expect(result, expectedMap);
      });
    });
  });
}
