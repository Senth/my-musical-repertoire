import 'package:dartz/dartz.dart';
import 'package:my_musical_repertoire/core/failures/server_failure.dart';
import '../entities/piece_entity.dart';
import '../../../../core/failures/failure.dart';
import '../../../../core/use_case.dart';
import '../repositories/piece_repository.dart';

class PieceAdd extends UseCase<PieceEntity, PieceEntity> {
  final PieceRepository repository;

  PieceAdd(this.repository);

  @override
  Future<Either<Failure, PieceEntity>> call(PieceEntity piece) async {
    try {
      return Right(await repository.addPiece(piece));
    } on ServerFailure catch (e) {
      return Left(e);
    }
  }
}
