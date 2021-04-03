import '../../../../core/failures/server_failure.dart';

import '../../../../core/failures/failure.dart';
import 'package:dartz/dartz.dart';
import '../../../../core/use_case.dart';
import '../repositories/piece_repository.dart';

class PieceRemove extends UseCase<String, String> {
  final PieceRepository repository;

  PieceRemove(this.repository);

  @override
  Future<Either<Failure, String>> call(String id) async {
    try {
      return Right(await repository.removePiece(id));
    } on ServerFailure catch (e) {
      return Left(e);
    }
  }
}
