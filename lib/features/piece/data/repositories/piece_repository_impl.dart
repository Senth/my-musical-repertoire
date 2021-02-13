import 'package:meta/meta.dart';
import 'package:my_musical_repertoire/core/failures/exceptions.dart';

import '../../../../core/failures/server_failure.dart';
import '../../domain/entities/piece_entity.dart';
import '../../domain/repositories/piece_repository.dart';
import '../datasources/piece_local_data_source.dart';
import '../models/piece_model.dart';

class PieceRepositoryImpl implements PieceRepository {
  final PieceLocalDataSource localDataSource;

  PieceRepositoryImpl({@required this.localDataSource});

  @override
  Future<PieceEntity> addPiece(PieceEntity piece) async {
    if (piece.id != null) {
      throw ServerFailure(type: ServerFailureTypes.idNotNullWhenAddNew);
    }

    try {
      final model = await localDataSource.addPiece(PieceModel.fromEntity(piece));
      return model.toEntity();
    } on LocalServerException {
      throw ServerFailure();
    }
  }

  @override
  Future<String> removePiece(String id) async {
    try {
      return await localDataSource.removePiece(id);
    } on LocalServerException {
      throw ServerFailure();
    }
  }

  @override
  Future<PieceEntity> updatePiece(PieceEntity piece) async {
    try {
      final model = await localDataSource.updatePiece(PieceModel.fromEntity(piece));
      return model.toEntity();
    } catch (LocalServerException) {
      throw ServerFailure();
    }
  }
}
