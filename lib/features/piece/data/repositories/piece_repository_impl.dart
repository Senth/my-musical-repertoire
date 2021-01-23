import 'package:dartz/dartz.dart';
import 'package:meta/meta.dart';

import '../../../../core/errors/error.dart';
import '../../../../core/errors/server_error.dart';
import '../../domain/entities/piece_entity.dart';
import '../../domain/repositories/piece_repository.dart';
import '../datasources/piece_local_data_source.dart';
import '../models/piece_model.dart';

class PieceRepositoryImpl implements PieceRepository {
  final PieceLocalDataSource localDataSource;

  PieceRepositoryImpl({@required this.localDataSource});

  @override
  Future<Either<Error, PieceEntity>> addPiece(PieceEntity piece) async {
    if (piece.id != null) {
      return Left(ServerError(type: ServerErrorTypes.idNotNullWhenAddNew));
    }

    try {
      final result = await localDataSource.addPiece(PieceModel.fromEntity(piece));
      return Right(result);
    } catch (LocalServerException) {
      return Left(ServerError());
    }
  }

  @override
  Future<Either<Error, String>> removePiece(String id) async {
    try {
      final result = await localDataSource.removePiece(id);
      return Right(result);
    } catch (LocalServerException) {
      return Left(ServerError());
    }
  }

  @override
  Future<Either<Error, PieceEntity>> updatePiece(PieceEntity piece) async {
    try {
      final result = await localDataSource.updatePiece(PieceModel.fromEntity(piece));
      return Right(result);
    } catch (LocalServerException) {
      return Left(ServerError());
    }
  }
}
