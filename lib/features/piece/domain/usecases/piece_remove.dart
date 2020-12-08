import 'package:my_musical_repertoire/core/errors/error.dart';
import 'package:dartz/dartz.dart';
import 'package:my_musical_repertoire/core/use_case.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';

class PieceRemove extends UseCase<String, String> {
  final PieceRepository repository;

  PieceRemove(this.repository);

  @override
  Future<Either<Error, String>> call(String id) async {
    return await repository.removePiece(id);
  }
}
