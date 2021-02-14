import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/hive_gateway.dart';
import 'package:my_musical_repertoire/features/piece/data/datasources/piece_local_data_source.dart';
import 'package:my_musical_repertoire/features/piece/data/datasources/piece_local_data_source_hive.dart';
import 'package:my_musical_repertoire/features/piece/data/models/piece_model.dart';

void main() {
  group("PieceLocalDataSourceHive (#db) ->", () {
    PieceLocalDataSource repo;
    setUp(() => HiveGateway.init(testing: true));
    tearDown(() => HiveGateway.close());
    setUpAll(() => repo = PieceLocalDataSourceHive());

    group("addPiece()", () {
      test("should add the specified piece to the DB and return with the new pieceModel when that piece doesn't exist",
          () async {
        final testData = [
          PieceModel(title: "Moonlight Sonata", composer: "Beethoven"),
          PieceModel(title: "Ronda alla Turca", composer: "Mozart", lastPracticed: DateTime.now())
        ];

        for (final test in testData) {
          final result = await repo.addPiece(test);
          // TODO CONTINUE
        }
      });
    });
  });
}
