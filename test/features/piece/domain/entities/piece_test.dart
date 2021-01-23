import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/consts.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

PieceEntity fakerPiece({String name, DateTime date}) {
  if (name == null) {
    name = "Moonlight Sonata";
  }
  if (date == null) {
    date = DateTime(2019, 03, 14, 23, 59);
  }
  return PieceEntity(
    id: "e085aac6-096c-41e8-9214-242b656691db",
    name: name,
    lastPracticed: date,
  );
}

PieceEntity copyFrom(
  PieceEntity original, {
  String name,
  DateTime lastPracticed,
}) {
  return PieceEntity(
    id: original.id,
    name: name != null ? name : original.name,
    lastPracticed: lastPracticed != null ? lastPracticed : original.lastPracticed,
  );
}

void main() {
  group("Piece Entity should (#entity #cold) ->", () {
    PieceEntity piece;
    PieceEntity original;
    PieceEntity copy;

    setUp(() {
      original = fakerPiece();
    });

    test('Be a valid', () {
      piece = fakerPiece();
      expect(piece.validate(), isEmpty);
    });

    test('Validate name too short', () {
      piece = fakerPiece(name: '12');
      expect(
          piece.validate(),
          equals(
            [
              ValidationInfo(
                type: ValidationTypes.nameTooShort,
                data: ValidationConsts.nameLengthMin.toString(),
              )
            ],
          ));
    });

    test('Validate date is in the future', () {
      piece = fakerPiece(date: DateTime.now().add(Duration(minutes: 1)));
      expect(
          piece.validate(),
          equals(
            [ValidationInfo(type: ValidationTypes.dateIsInTheFuture)],
          ));
    });

    test('Be equal to itself', () {
      copy = copyFrom(original);
      expect(copy, original);
    });

    test("Not be equal to itself when changing any property", () {
      final testData = [
        // Name
        PieceEntity(id: original.id, name: 'different', lastPracticed: original.lastPracticed),
        PieceEntity(id: original.id, name: null, lastPracticed: original.lastPracticed),
        // Date
        PieceEntity(id: original.id, name: original.name, lastPracticed: DateTime(2017)),
        PieceEntity(id: original.id, name: original.name, lastPracticed: null),
      ];

      for (copy in testData) {
        expect(copy, isNot(original));
      }
    });

    test('copy() should be equal to the original', () {
      final testData = [
        original.copy(),
        original.copy(id: null),
        original.copy(name: null),
        original.copy(lastPracticed: null),
      ];

      for (copy in testData) {
        expect(copy, original);
      }
    });

    test("copy(param) with a parameter should not be equal to the original", () {
      final testData = [
        original.copy(id: 'different'),
        original.copy(name: 'different'),
        original.copy(lastPracticed: DateTime(2017)),
      ];

      for (copy in testData) {
        expect(copy, isNot(original));
      }
    });
  });
}
