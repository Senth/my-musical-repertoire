import 'package:dartz/dartz.dart';

import '../../../../core/errors/error.dart';
import '../entities/piece.dart';

abstract class PieceRepository {
  Future<Either<Error, Piece>> addPiece(Piece piece);
  Future<Either<Error, Piece>> updatePiece(Piece piece);
  Future<Either<Error, String>> removePiece(String id);
}
