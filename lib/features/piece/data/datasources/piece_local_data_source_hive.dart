import 'package:my_musical_repertoire/core/hive_gateway.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

import 'piece_local_data_source.dart';

class PieceLocalDataSourceHive extends HiveGateway implements PieceLocalDataSource {
  @override
  Future<PieceEntity> addPiece(PieceEntity piece) async {
    final id = HiveGateway.generateId();
    piece = piece.copy(id: id);

    final box = await HiveGateway.piecesBox;
    await box.put(id, piece.toJson());
    return piece;
  }

  @override
  Future<String> removePiece(String id) async {
    final box = await HiveGateway.piecesBox;
    await box.delete(id);
    return id;
  }

  @override
  Future<PieceEntity> updatePiece(PieceEntity piece) async {
    final box = await HiveGateway.piecesBox;
    await box.put(piece.id, piece.toJson());
    return piece;
  }
}
