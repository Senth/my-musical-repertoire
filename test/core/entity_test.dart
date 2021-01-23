import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/entity.dart';

class BaseEntity extends Entity {
  BaseEntity(String id) : super(id);
}

void main() {
  group("Base Entity #entity #cold", () {
    test("Valid Entity", () {
      List<BaseEntity> inputs = [
        new BaseEntity("0"),
        new BaseEntity("dde24271-af67-4ccd-809c-12dda1402a5e"),
        new BaseEntity(""),
        new BaseEntity(null),
      ];

      for (BaseEntity entity in inputs) {
        expect(entity.validate(), isEmpty);
      }
    });

    test("should be equal when both entities have same properties", () {
      List<List<BaseEntity>> testData = [
        [new BaseEntity("id"), new BaseEntity("id")],
        [new BaseEntity(null), new BaseEntity(null)],
      ];

      for (List<BaseEntity> test in testData) {
        expect(test[0], test[1]);
      }
    });

    test("should not be equal when changing any property", () {
      List<List<BaseEntity>> testData = [
        [new BaseEntity("id"), new BaseEntity(null)],
        [new BaseEntity("id"), new BaseEntity("different")],
        [new BaseEntity(null), new BaseEntity("32b8f9a8-0428-44e1-88c0-1b0098fd9c1f")],
      ];

      for (List<BaseEntity> test in testData) {
        expect(test[0], isNot(test[1]));
      }
    });
  });
}
