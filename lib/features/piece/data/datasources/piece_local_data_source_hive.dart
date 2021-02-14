import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

import 'piece_local_data_source.dart';

class PieceLocalDataSourceHive implements PieceLocalDataSource {
  @override
  Future<PieceEntity> addPiece(PieceEntity piece) {
    // TODO: implement addPiece
    throw UnimplementedError();
  }

  @override
  Future<String> removePiece(String id) {
    // TODO: implement removePiece
    throw UnimplementedError();
  }

  @override
  Future<PieceEntity> updatePiece(PieceEntity piece) {
    // TODO: implement updatePiece
    throw UnimplementedError();
  }
}
