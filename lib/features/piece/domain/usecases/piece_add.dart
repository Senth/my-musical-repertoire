import 'package:dartz/dartz.dart';
import '../entities/piece_entity.dart';
import '../../../../core/errors/error.dart';
import '../../../../core/use_case.dart';
import '../repositories/piece_repository.dart';

class PieceAdd extends UseCase<PieceEntity, PieceEntity> {
  final PieceRepository repository;

  PieceAdd(this.repository);

  @override
  Future<Either<Error, PieceEntity>> call(PieceEntity piece) async {
    return await repository.addPiece(piece);
  }
}
