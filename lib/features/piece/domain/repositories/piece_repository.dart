import '../entities/piece_entity.dart';

abstract class PieceRepository {
  /// Add a new piece to your musical repertoire
  /// Returns the piece with a set newly set id
  /// Throws a [Failure] if the piece couldn't be added
  Future<PieceEntity> addPiece(PieceEntity piece);

  /// Update/Save the changed piece information
  /// Returns the updated piece.
  /// Throws a [Failure] if the piece couldn't be updated
  Future<PieceEntity> updatePiece(PieceEntity piece);

  /// Remove a piece with [id]
  /// Returns the [id] if the piece was successfully removed.
  /// Throws a [Failure] if something went wrong
  Future<String> removePiece(String id);
}
