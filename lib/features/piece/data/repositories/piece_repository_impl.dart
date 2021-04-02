import 'package:my_musical_repertoire/core/failures/exceptions.dart';

import '../../../../core/failures/server_failure.dart';
import '../../domain/entities/piece_entity.dart';
import '../../domain/repositories/piece_repository.dart';
import '../datasources/piece_local_data_source.dart';

class PieceRepositoryImpl implements PieceRepository {
  final PieceLocalDataSource localDataSource;

  PieceRepositoryImpl({required this.localDataSource});

  @override
  Future<PieceEntity> addPiece(PieceEntity piece) async {
    if (piece.id != null) {
      throw ServerFailure(type: ServerFailureTypes.idNotNullWhenAddNew);
    }

    try {
      return await localDataSource.add(piece);
    } on LocalServerException {
      throw ServerFailure();
    }
  }

  @override
  Future<String> removePiece(String id) async {
    try {
      return await localDataSource.remove(id);
    } on LocalServerException {
      throw ServerFailure();
    }
  }

  @override
  Future<PieceEntity> updatePiece(PieceEntity piece) async {
    try {
      return await localDataSource.update(piece);
    } on LocalServerException {
      throw ServerFailure();
    }
  }

  @override
  Future<List<PieceEntity>> getPieces() async {
    try {
      return await localDataSource.getAll();
    } on LocalServerException {
      throw ServerFailure();
    }
  }
}
