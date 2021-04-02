import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/hive_gateway.dart';
import 'package:my_musical_repertoire/features/piece/data/datasources/piece_local_data_source.dart';
import 'package:my_musical_repertoire/features/piece/data/datasources/piece_local_data_source_hive.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

void main() {
  group("PieceLocalDataSourceHive (#db) ->", () {
    late PieceLocalDataSource repo;
    setUp(() => HiveGateway.init(testing: true));
    tearDown(() => HiveGateway.close());
    setUpAll(() => repo = PieceLocalDataSourceHive());

    test("add() should add the piece to the DB and return with inserted (with ID) when that piece does not exist", () async {
      final testData = [
        PieceEntity(title: "Moonlight Sonata", composer: "Beethoven"),
        PieceEntity(title: "Ronda alla Turca", composer: "Mozart", lastPracticed: DateTime.now())
      ];
      final box = await HiveGateway.piecesBox!;

      for (final test in testData) {
        final result = await repo.add(test);
        expect(result, test.copy(id: result.id));
        expect(box.get(result.id), result.toJson());
      }
    });

    test("remove() should remove the piece from the DB when the piece exists in the DB", () async {
      final box = await HiveGateway.piecesBox!;
      final testData = [
        PieceEntity(id: "1", title: "Moonlight", composer: "Beethoven"),
        PieceEntity(id: "2", title: "Turca", composer: "Mozart"),
      ];

      for (final test in testData) {
        await box.put(test.id, test.toJson());
        final result = await repo.remove(test.id);
        expect(result, test.id);
      }
    });

    test("update() should update the saved piece when updating with new values", () async {
      final box = await HiveGateway.piecesBox!;
      final testData = [
        PieceEntity(id: "1", title: "Moonlight", composer: "Beethoven"),
        PieceEntity(id: "1", title: "Turca", composer: "Mozart"),
        PieceEntity(id: "1", title: "Military March", composer: "Schubert"),
      ];

      for (final test in testData) {
        final result = await repo.update(test);
        expect(result, test);
        expect(result, PieceEntity.fromJson(await box.get(test.id)));
      }
    });

    test("getAll() should return all saved entities when everything is working", () async {
      final box = await HiveGateway.piecesBox!;
      final testData = [
        PieceEntity(id: "1", title: "Moonlight", composer: "Beethoven"),
        PieceEntity(id: "2", title: "Turca", composer: "Mozart"),
        PieceEntity(id: "3", title: "Military March", composer: "Schubert"),
      ];
      final testDataMap = {for (final entity in testData) entity.id: entity.toJson()};
      box.putAll(testDataMap);

      final result = await repo.getAll();
      expect(result, testData);
    });
  });
}
