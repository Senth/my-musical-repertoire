import 'package:dartz/dartz.dart';
import 'package:my_musical_repertoire/core/errors/error.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece.dart';

abstract class PieceRepository {
  Future<Either<Error, Piece>> addPiece(Piece piece);
  Future<Either<Error, Piece>> updatePiece(Piece piece);
  Future<Either<Error, String>> removePiece(String id);
}
