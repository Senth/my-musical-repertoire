import '../../domain/entities/piece_entity.dart';
import '../models/piece_model.dart';

abstract class PieceLocalDataSource {
  /// Add a new piece to the local storage.
  /// Returns the piece with a set newly set id.
  /// Throws a [LocalDataSourceException] if the piece couldn't be added
  Future<PieceEntity> addPiece(PieceModel piece);

  /// Update/Save the changed piece information in the local storage.
  /// Returns the updated piece.
  /// Throws an [LocalDataSourceException] if the piece couldn't be updated
  Future<PieceEntity> updatePiece(PieceModel piece);

  /// Remove a piece with [id] from the local storage.
  /// Returns the [id] if the piece was successfully removed
  /// Throws an [LocalDataSourceException] if something went wrong
  Future<String> removePiece(String id);
}
