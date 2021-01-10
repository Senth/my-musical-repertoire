import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/entity.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';

class BaseEntity extends Entity {
  BaseEntity(String? id) : super(id);
}

void main() {
  group("Base Entity #entity #cold", () {
    Entity entity;

    test("Valid id", () {
      entity = new BaseEntity("0");

      expect(entity.validate(), isEmpty);
    });

    test("Id is null", () {
      entity = new BaseEntity(null);
      expect(entity.validate(),
          equals([new ValidationInfo(type: ValidationTypes.idNotDefined)]));
    });

    test("Id is empty", () {
      entity = new BaseEntity("");
      expect(entity.validate(),
          equals([new ValidationInfo(type: ValidationTypes.idIsEmpty)]));
    });
  });
}
