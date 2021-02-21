import '../../domain/entities/piece_entity.dart';

abstract class PieceLocalDataSource {
  /// Add a new piece to the local storage.
  /// Returns the piece with a set newly set id.
  Future<PieceEntity> add(PieceEntity piece);

  /// Update/Save the changed piece information in the local storage.
  /// Returns the updated piece.
  Future<PieceEntity> update(PieceEntity piece);

  /// Remove a piece with [id] from the local storage.
  /// Returns the [id] if the piece was successfully removed
  Future<String> remove(String id);

  /// Returns all pieces from the local storage
  Future<List<PieceEntity>> getAll();
}
