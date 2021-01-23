import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/errors/server_error.dart';

void main() {
  group("ServerError (#cold) ->", () {
    test("two ServerErrors should be equal when all properties are equal", () {
      final testData = [
        [
          ServerError(type: ServerErrorTypes.idNotNullWhenAddNew),
          ServerError(type: ServerErrorTypes.idNotNullWhenAddNew),
        ],
        [
          ServerError(type: null),
          ServerError(type: null),
        ],
        [
          ServerError(),
          ServerError(type: ServerErrorTypes.unknown),
        ]
      ];

      for (List<ServerError> test in testData) {
        expect(test[0], test[1]);
      }
    });

    test("two ServerErrors should not be equal when one property differ", () {
      final testData = [
        [
          ServerError(type: ServerErrorTypes.idNotNullWhenAddNew),
          ServerError(type: ServerErrorTypes.unknown),
        ],
        [
          ServerError(type: null),
          ServerError(type: ServerErrorTypes.unknown),
        ],
        [
          ServerError(),
          ServerError(type: null),
        ],
      ];

      for (List<ServerError> test in testData) {
        expect(test[0], isNot(test[1]));
      }
    });
  });
}
