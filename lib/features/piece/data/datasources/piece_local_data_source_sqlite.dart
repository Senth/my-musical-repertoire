import '../../domain/entities/piece_entity.dart';
import '../models/piece_model.dart';
import 'piece_local_data_source.dart';

class PieceLocalDataSourceSqlite implements PieceLocalDataSource {
  @override
  Future<PieceEntity> addPiece(PieceModel piece) {
    // TODO: implement addPiece
    throw UnimplementedError();
  }

  @override
  Future<String> removePiece(String? id) {
    // TODO: implement removePiece
    throw UnimplementedError();
  }

  @override
  Future<PieceEntity> updatePiece(PieceModel piece) {
    // TODO: implement updatePiece
    throw UnimplementedError();
  }
}
