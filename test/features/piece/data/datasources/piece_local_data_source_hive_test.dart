import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/hive_gateway.dart';

void main() {
  group("PieceLocalDataSourceHive (#db) ->", () {
    setUp(() => HiveGateway.init(testing: true));

    tearDown(() => HiveGateway.close());

    test(
        "addPiece() should add the specified piece to the DB and return with the new pieceModel when that piece doesn't exist",
        () {
      // TODO
    });
  });
}
