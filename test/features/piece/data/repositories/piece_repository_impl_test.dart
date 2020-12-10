import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/core/errors/error.dart';
import 'package:my_musical_repertoire/features/piece/data/datasources/piece_local_data_source.dart';
import 'package:my_musical_repertoire/features/piece/data/models/piece_model.dart';
import 'package:my_musical_repertoire/features/piece/data/repositories/piece_repository_impl.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

class MockLocalDataSource extends Mock implements PieceLocalDataSource {}

void main() {
  group("PieceRepositoryImpl (#repository #cold) ->", () {
    PieceRepositoryImpl repository;
    MockLocalDataSource mockLocalDataSource;
    final piece = PieceEntity(id: "1", name: "Test name");
    final pieceModel = PieceModel(id: piece.id, name: piece.name);

    setUp(() {
      mockLocalDataSource = MockLocalDataSource();
      repository = PieceRepositoryImpl(localDataSource: mockLocalDataSource);
    });

    group("addPiece()", () {
      test("should return the local and updated piece when adding a piece", () async {
        when(mockLocalDataSource.addPiece(any)).thenAnswer((_) async => pieceModel);
        final result = await repository.addPiece(piece);
        verify(mockLocalDataSource.addPiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result.getOrElse(null), isA<PieceEntity>());
        expect(result, equals(Right(pieceModel)));
      });

      test("should return a LocalServerError when the repository throws a LocalServerException", () async {
        when(mockLocalDataSource.addPiece(any)).thenAnswer((_) async => throw LocalServerError());
        final result = await repository.addPiece(piece);
        verify(mockLocalDataSource.addPiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, equals(Left(LocalServerError())));
      });
    });

    group("removePiece()", () {
      test("should return the id of the removed piece when removing a piece", () async {
        when(mockLocalDataSource.removePiece(any)).thenAnswer((_) async => piece.id);
        final result = await repository.removePiece(piece.id);
        verify(mockLocalDataSource.removePiece(piece.id));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, equals(Right(piece.id)));
      });

      test("should return a LocalServerError when the repository throws a LocalServerException", () async {
        when(mockLocalDataSource.removePiece(any)).thenAnswer((_) async => throw LocalServerError());
        final result = await repository.removePiece(piece.id);
        verify(mockLocalDataSource.removePiece(piece.id));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, equals(Left(LocalServerError())));
      });
    });

    group("updatePiece()", () {
      test("should return the local and updated piece when updating a piece", () async {
        when(mockLocalDataSource.updatePiece(any)).thenAnswer((_) async => pieceModel);
        final result = await repository.updatePiece(piece);
        verify(mockLocalDataSource.updatePiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result.getOrElse(null), isA<PieceEntity>());
        expect(result, equals(Right(pieceModel)));
      });

      test("should return a LocalServerError when the repository throws a LocalServerException", () async {
        when(mockLocalDataSource.updatePiece(any)).thenAnswer((_) async => throw LocalServerError());
        final result = await repository.updatePiece(piece);
        verify(mockLocalDataSource.updatePiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, equals(Left(LocalServerError())));
      });
    });
  });
}
