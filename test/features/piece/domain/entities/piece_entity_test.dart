import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/failures/validation_failure.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

PieceEntity fakerPiece({String? title, String? composer, DateTime? date}) {
  if (title == null) {
    title = "Moonlight Sonata";
  }
  if (date == null) {
    date = DateTime(2019, 03, 14, 23, 59);
  }
  if (composer == null) {
    composer = "Beethoven";
  }
  return PieceEntity(
    id: "e085aac6-096c-41e8-9214-242b656691db",
    title: title,
    composer: composer,
    lastPracticed: date,
  );
}

PieceEntity copyFrom(
  PieceEntity original, {
  String? title,
  String? composer,
  DateTime? lastPracticed,
}) {
  return PieceEntity(
    id: original.id,
    title: title != null ? title : original.title,
    composer: composer != null ? composer : original.composer,
    lastPracticed: lastPracticed != null ? lastPracticed : original.lastPracticed,
  );
}

void main() {
  group("Piece Entity should (#entity #cold) ->", () {
    PieceEntity piece;
    late PieceEntity original;
    PieceEntity copy;

    setUp(() {
      original = fakerPiece();
    });

    test('Be a valid when all fields are used and valid', () {
      piece = fakerPiece();
      expect(piece.validate(), isEmpty);
    });

    test('Validate title required', () {
      final testData = [
        fakerPiece(title: ''),
        PieceEntity(id: original.id, title: '', composer: original.composer, lastPracticed: original.lastPracticed),
      ];

      for (piece in testData) {
        expect(
          piece.validate(),
          equals([ValidationInfo(type: ValidationTypes.titleRequired)]),
        );
      }

      piece = fakerPiece(title: '');
    });

    test('Validate composer required', () {
      final testData = [
        fakerPiece(composer: ''),
        PieceEntity(id: original.id, title: original.title, composer: "", lastPracticed: original.lastPracticed),
      ];

      for (piece in testData) {
        expect(
          piece.validate(),
          equals([ValidationInfo(type: ValidationTypes.composerRequired)]),
        );
      }

      piece = fakerPiece(title: '');
    });

    test('Validate date is in the future', () {
      piece = fakerPiece(date: DateTime.now().add(Duration(minutes: 1)));
      expect(
          piece.validate(),
          equals(
            [ValidationInfo(type: ValidationTypes.dateIsInTheFuture)],
          ));
    });

    test('Be equal to itself when two contain the same values', () {
      copy = copyFrom(original);
      expect(copy, original);
    });

    test("fromJson() should return a valid entity when all the fields are valid", () {
      final testData = [
        {
          "input": {"id": "1", "title": "Moonlight", "composer": "Beethoven"},
          "expected": PieceEntity(id: '1', title: 'Moonlight', composer: 'Beethoven'),
        },
        {
          "input": {"id": "1", "title": "Moonlight", "composer": "Beethoven", "lastPracticed": "2020-02-13T00:00:00.000"},
          "expected": PieceEntity(id: '1', title: 'Moonlight', composer: 'Beethoven', lastPracticed: DateTime(2020, 02, 13)),
        },
      ];

      for (final test in testData) {
        final result = PieceEntity.fromJson(test["input"] as Map<String, dynamic>);
        expect(result, test["expected"]);
      }
    });

    test("toJson() should return a valid map when the JSON model is valid", () {
      final testData = [
        {
          "input": PieceEntity(id: '1', title: 'Moonlight', composer: 'Beethoven'),
          "expected": {"id": "1", "title": "Moonlight", "composer": "Beethoven", "lastPracticed": null},
        },
        {
          "input": PieceEntity(id: '1', title: 'Moonlight', composer: 'Beethoven', lastPracticed: DateTime(2020, 02, 13)),
          "expected": {"id": "1", "title": "Moonlight", "composer": "Beethoven", "lastPracticed": "2020-02-13T00:00:00.000"},
        },
      ];

      for (final test in testData) {
        final result = (test["input"] as PieceEntity).toJson();
        expect(result, test["expected"]);
      }
    });
  });
}
