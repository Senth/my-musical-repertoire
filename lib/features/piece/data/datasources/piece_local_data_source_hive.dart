import '../../../../core/hive_gateway.dart';
import '../../domain/entities/piece_entity.dart';

import 'piece_local_data_source.dart';

class PieceLocalDataSourceHive extends HiveGateway implements PieceLocalDataSource {
  @override
  Future<PieceEntity> add(PieceEntity piece) async {
    final id = HiveGateway.generateId();
    piece = piece.copyWith(id: id);

    final box = await HiveGateway.piecesBox;
    await box.put(id, piece.toJson());
    return piece;
  }

  @override
  Future<String> remove(String id) async {
    final box = await HiveGateway.piecesBox;
    await box.delete(id);
    return id;
  }

  @override
  Future<PieceEntity> update(PieceEntity piece) async {
    final box = await HiveGateway.piecesBox;
    await box.put(piece.id, piece.toJson());
    return piece;
  }

  @override
  Future<List<PieceEntity>> getAll() async {
    final box = await HiveGateway.piecesBox;
    final List<PieceEntity> pieces = [];
    final jsonPieces = box.toMap().values;
    for (final json in jsonPieces) {
      pieces.add(PieceEntity.fromJson(json));
    }
    return pieces;
  }
}
