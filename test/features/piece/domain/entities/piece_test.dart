import 'package:faker/faker.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/consts.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece.dart';

const faker = Faker();

Piece fakerPiece({String name, DateTime date}) {
  if (name == null) {
    name = faker.person.firstName();
  }
  if (date == null) {
    date = faker.date.dateTime(minYear: 2018, maxYear: 2019);
  }
  return new Piece(
    id: faker.guid.guid(),
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
  group("Piece #entity #cold", () {
    Piece piece;

    test('Valid entity', () {
      piece = fakerPiece();
      expect(piece.validate(), isEmpty);
    });

    test('Name too short', () {
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

    test('Date is in the future', () {
      piece = fakerPiece(date: DateTime.now().add(new Duration(minutes: 1)));
      expect(
          piece.validate(),
          equals(
            [new ValidationInfo(type: ValidationTypes.dateIsInTheFuture)],
          ));
    });

    test('Equality', () {
      final Piece original = fakerPiece();
      Piece copy = copyFrom(original);
      expect(copy, original);

      // Name
      copy = copyFrom(original, name: 'different');
      expect(copy, isNot(original));

      // Date
      copy = copyFrom(original, date: new DateTime(2017));
      expect(copy, isNot(original));
    });

    test('copy()', () {
      final Piece original = fakerPiece();
      Piece copy = original.copy();
      expect(copy, original);

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
