import 'package:faker/faker.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/consts.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece.dart';

const _faker = Faker();

Piece fakerPiece({String name, DateTime date}) {
  if (name == null) {
    name = _faker.person.firstName();
  }
  if (date == null) {
    date = _faker.date.dateTime(minYear: 2018, maxYear: 2019);
  }
  return new Piece(
    id: _faker.guid.guid(),
    name: name,
    lastPracticed: date,
  );
}

Piece copyFrom(
  Piece original, {
  String name,
  DateTime date,
}) {
  return new Piece(
    id: original.id,
    name: name != null ? name : original.name,
    lastPracticed: date != null ? date : original.lastPracticed,
  );
}

void main() {
  group("Piece Entity should (#entity #cold) ->", () {
    Piece piece;
    Piece original;
    Piece copy;

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
              new ValidationInfo(
                type: ValidationTypes.nameTooShort,
                data: ValidationConsts.nameLengthMin.toString(),
              )
            ],
          ));
    });

    test('Validate date is in the future', () {
      piece = fakerPiece(date: DateTime.now().add(new Duration(minutes: 1)));
      expect(
          piece.validate(),
          equals(
            [new ValidationInfo(type: ValidationTypes.dateIsInTheFuture)],
          ));
    });

    test('Be equal to itself', () {
      copy = copyFrom(original);
      expect(copy, original);
    });

    test("Not be equal to itself when changing any property", () {
      // Name
      copy = copyFrom(original, name: 'different');
      expect(copy, isNot(original));

      // Date
      copy = copyFrom(original, date: new DateTime(2017));
      expect(copy, isNot(original));
    });

    test('copy() should be equal to the original', () {
      copy = original.copy();
      expect(copy, original);
    });

    test("copy(param) with a parameter should not be equal to the original", () {
      // Id
      copy = original.copy(id: 'different');
      expect(copy, isNot(original));

      // Name
      copy = original.copy(name: 'different');
      expect(copy, isNot(original));

      // Date
      copy = original.copy(lastPracticed: new DateTime(2017));
      expect(copy, isNot(original));
    });
  });
}
