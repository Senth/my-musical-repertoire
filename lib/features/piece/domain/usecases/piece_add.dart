import 'package:dartz/dartz.dart';
import 'package:my_musical_repertoire/core/errors/error.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';

class PieceAdd {
  final PieceRepository repository;

  PieceAdd(this.repository);

  Future<Either<Error, Piece>> execute(Piece piece) async {
    return await repository.addPiece(piece);
  }
}
