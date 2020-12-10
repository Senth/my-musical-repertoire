import 'package:dartz/dartz.dart';

import '../../../../core/errors/error.dart';
import '../entities/piece_entity.dart';

abstract class PieceRepository {
  /// Add a new piece to your musical repertoire
  /// Returns the piece with a set newly set id or an [Error] if the piece couldn't be added
  Future<Either<Error, PieceEntity>> addPiece(PieceEntity piece);

  /// Update/Save the changed piece information
  /// Returns the updated piece or an [Error] if the piece couldn't be updated
  Future<Either<Error, PieceEntity>> updatePiece(PieceEntity piece);

  /// Remove a piece with [id]
  /// Returns the [id] if the piece was successfully removed, or an [Error] if something went wrong
  Future<Either<Error, String>> removePiece(String id);
}
