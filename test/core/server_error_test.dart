import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/failures/server_failure.dart';

void main() {
  group("ServerError (#cold) ->", () {
    test("two ServerErrors should be equal when all properties are equal", () {
      final testData = [
        [
          ServerFailure(type: ServerFailureTypes.idNotNullWhenAddNew),
          ServerFailure(type: ServerFailureTypes.idNotNullWhenAddNew),
        ],
        [
          ServerFailure(),
          ServerFailure(type: ServerFailureTypes.unknown),
        ]
      ];

      for (List<ServerFailure> test in testData) {
        expect(test[0], test[1]);
      }
    });

    test("two ServerErrors should not be equal when one property differ", () {
      final testData = [
        [
          ServerFailure(type: ServerFailureTypes.idNotNullWhenAddNew),
          ServerFailure(type: ServerFailureTypes.unknown),
        ],
      ];

      for (List<ServerFailure> test in testData) {
        expect(test[0], isNot(test[1]));
      }
    });
  });
}
