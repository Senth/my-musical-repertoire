import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/practice_entity.dart';

PracticeEntity fakerPractice({String id, DateTime date}) {
  if (id == null) {
    id = "8a079f87-be77-439c-99c1-1675b59d7bd5";
  }
  if (id == 'null') {
    id = null;
  }
  if (date == null) {
    date = DateTime.now();
  }
  return new PracticeEntity(
    id: null,
    pieceId: id,
    date: date,
    technicalMistakes: PracticeMistakes.none,
    memoryFlubs: PracticeMistakes.none,
  );
}

PracticeEntity copyFrom(
  PracticeEntity original, {
  String pieceId,
  DateTime date,
  PracticeMistakes technicalMistakes,
  PracticeMistakes memoryFlubs,
}) {
  return new PracticeEntity(
    id: original.id,
    pieceId: pieceId != null ? pieceId : original.pieceId,
    date: date != null ? date : original.date,
    technicalMistakes: technicalMistakes != null ? technicalMistakes : original.technicalMistakes,
    memoryFlubs: memoryFlubs != null ? memoryFlubs : original.memoryFlubs,
  );
}

void main() {
  group("Practice Entity should (#entity #cold) ->", () {
    PracticeEntity practice;
    PracticeEntity original;
    PracticeEntity copy;

    setUp(() {
      original = fakerPractice();
    });

    test("Have be a valid entity", () {
      practice = fakerPractice(id: null);
      expect(practice.validate(), isEmpty);
    });

    test("Validate that id is not defined", () {
      List<PracticeEntity> testData = [
        fakerPractice(id: 'null'),
        fakerPractice(id: ''),
      ];

      for (practice in testData) {
        expect(practice.validate(), equals([new ValidationInfo(type: ValidationTypes.idNotDefined)]));
      }
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
      List<PracticeEntity> testData = [
        new PracticeEntity(
          id: 'different',
          pieceId: original.pieceId,
          date: original.date,
          technicalMistakes: original.technicalMistakes,
          memoryFlubs: original.memoryFlubs,
        ),
        new PracticeEntity(
          id: original.id,
          pieceId: 'different',
          date: original.date,
          technicalMistakes: original.technicalMistakes,
          memoryFlubs: original.memoryFlubs,
        ),
        new PracticeEntity(
          id: original.id,
          pieceId: original.pieceId,
          date: new DateTime(2019),
          technicalMistakes: original.technicalMistakes,
          memoryFlubs: original.memoryFlubs,
        ),
        new PracticeEntity(
          id: original.id,
          pieceId: original.pieceId,
          date: original.date,
          technicalMistakes: PracticeMistakes.everywhere,
          memoryFlubs: original.memoryFlubs,
        ),
        new PracticeEntity(
          id: original.id,
          pieceId: original.pieceId,
          date: original.date,
          technicalMistakes: original.technicalMistakes,
          memoryFlubs: PracticeMistakes.everywhere,
        ),
      ];

      for (copy in testData) {
        expect(copy, isNot(original));
      }
    });

    test("copy() should be equal to the original", () {
      List<PracticeEntity> testData = [
        original.copy(),
        original.copy(id: null),
        original.copy(pieceId: null),
        original.copy(date: null),
        original.copy(technicalMistakes: null),
        original.copy(memoryFlubs: null),
      ];

      for (copy in testData) {
        expect(copy, original);
      }
    });

    test("copy(param) with a parameter should not be equal to the original", () {
      List<PracticeEntity> testData = [
        original.copy(id: 'different'),
        original.copy(pieceId: 'different'),
        original.copy(date: new DateTime(2019)),
        original.copy(technicalMistakes: PracticeMistakes.everywhere),
        original.copy(memoryFlubs: PracticeMistakes.everywhere),
      ];

      for (copy in testData) {
        expect(copy, isNot(original));
      }
    });
  });
}
