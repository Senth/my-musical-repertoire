import 'package:my_musical_repertoire/core/errors/error.dart';
import 'package:dartz/dartz.dart';
import 'package:my_musical_repertoire/core/use_case.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';

class PieceEdit extends UseCase<Piece, Piece> {
  final PieceRepository repository;

  PieceEdit(this.repository);

  @override
  Future<Either<Error, Piece>> call(Piece piece) async {
    return await repository.updatePiece(piece);
  }
}
