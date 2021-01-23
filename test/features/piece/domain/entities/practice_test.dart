import 'package:faker/faker.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/practice.dart';

const _faker = Faker();

Practice fakerPractice({String id, DateTime date}) {
  if (id == null) {
    id = _faker.guid.guid();
  }
  if (id == 'null') {
    id = null;
  }
  if (date == null) {
    date = DateTime.now();
  }
  return new Practice(
    id: _faker.guid.guid(),
    pieceId: id,
    date: date,
    technicalMistakes: PracticeMistakes.none,
    memoryFlubs: PracticeMistakes.none,
  );
}

Practice copyFrom(
  Practice original, {
  String pieceId,
  DateTime date,
  PracticeMistakes technicalMistakes,
  PracticeMistakes memoryFlubs,
}) {
  return new Practice(
    id: original.id,
    pieceId: pieceId != null ? pieceId : original.pieceId,
    date: date != null ? date : original.date,
    technicalMistakes: technicalMistakes != null ? technicalMistakes : original.technicalMistakes,
    memoryFlubs: memoryFlubs != null ? memoryFlubs : original.memoryFlubs,
  );
}

void main() {
  group("Practice Entity should (#entity #cold) ->", () {
    Practice practice;
    Practice original;
    Practice copy;

    setUp(() {
      original = fakerPractice();
    });

    test("Have be a valid entity", () {
      practice = fakerPractice(id: null);
      expect(practice.validate(), isEmpty);
    });

    test("Validate that id is not defined", () {
      practice = fakerPractice(id: 'null');
      expect(practice.validate(), equals([new ValidationInfo(type: ValidationTypes.idNotDefined)]));
    });

    test("Validate that id is empty", () {
      practice = fakerPractice(id: "");
      expect(practice.validate(), equals([new ValidationInfo(type: ValidationTypes.idIsEmpty)]));
    });

    test("Validate that date is in the future", () {
      practice = fakerPractice(date: DateTime.now().add(new Duration(minutes: 1)));
      expect(
          practice.validate(),
          equals(
            [new ValidationInfo(type: ValidationTypes.dateIsInTheFuture)],
          ));
    });

    test("Be equal to itself", () {
      copy = copyFrom(original);
      expect(copy, original);
    });

    test("Not be equal to itself when changing any property", () {
      // Piece id
      copy = copyFrom(original, pieceId: 'different');
      expect(copy, isNot(original));

      // Date
      copy = copyFrom(original, date: new DateTime(2019));
      expect(copy, isNot(original));

      // Technical mistakes
      copy = copyFrom(original, technicalMistakes: PracticeMistakes.everywhere);
      expect(copy, isNot(original));

      // Memory flubs
      copy = copyFrom(original, memoryFlubs: PracticeMistakes.everywhere);
      expect(copy, isNot(original));
    });

    test("copy() should be equal to the original", () {
      copy = original.copy();
      expect(copy, original);
    });

    test("copy(param) with a parameter should not be equal to the original", () {
      // Id
      copy = original.copy(id: 'different');
      expect(copy, isNot(original));

      // Piece id
      copy = original.copy(pieceId: 'different');
      expect(copy, isNot(original));

      // Date
      copy = original.copy(date: new DateTime(2019));
      expect(copy, isNot(original));

      // Technical mistakes
      copy = original.copy(technicalMistakes: PracticeMistakes.everywhere);
      expect(copy, isNot(original));

      // Memory flubs
      copy = original.copy(memoryFlubs: PracticeMistakes.everywhere);
      expect(copy, isNot(original));
    });
  });
}
