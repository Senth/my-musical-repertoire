import 'package:dartz/dartz.dart';

import '../../../../core/errors/error.dart';
import '../../../../core/use_case.dart';
import '../entities/piece.dart';
import '../repositories/piece_repository.dart';

class PieceEdit extends UseCase<Piece, Piece> {
  final PieceRepository repository;

  PieceEdit(this.repository);

  @override
  Future<Either<Error, Piece>> call(Piece piece) async {
    return await repository.updatePiece(piece);
  }
}
