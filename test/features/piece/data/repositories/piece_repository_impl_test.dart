import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/core/failures/exceptions.dart';
import 'package:my_musical_repertoire/core/failures/server_failure.dart';
import 'package:my_musical_repertoire/features/piece/data/datasources/piece_local_data_source.dart';
import 'package:my_musical_repertoire/features/piece/data/models/piece_model.dart';
import 'package:my_musical_repertoire/features/piece/data/repositories/piece_repository_impl.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

class MockLocalDataSource extends Mock implements PieceLocalDataSource {}

void main() {
  group("PieceRepositoryImpl (#repository #cold) ->", () {
    PieceRepositoryImpl repository;
    MockLocalDataSource mockLocalDataSource;
    final piece = PieceEntity(id: null, title: "Test name", composer: "Composer");
    final pieceModel = PieceModel(id: piece.id, title: piece.title, composer: piece.composer);

    setUp(() {
      mockLocalDataSource = MockLocalDataSource();
      repository = PieceRepositoryImpl(localDataSource: mockLocalDataSource);
    });

    group("addPiece()", () {
      test("should return the local and updated piece when adding a piece", () async {
        final piece = PieceEntity(id: null, title: "Test name", composer: "Composer");
        when(mockLocalDataSource.addPiece(any)).thenAnswer((_) async => pieceModel);

        final result = await repository.addPiece(piece);

        verify(mockLocalDataSource.addPiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, isA<PieceEntity>());
        expect(result, equals(PieceEntity(id: piece.id, title: piece.title, composer: piece.composer)));
      });

      test("should throw a ServerFailure when the repository throws a LocalServerException", () {
        when(mockLocalDataSource.addPiece(any)).thenAnswer((_) async => throw LocalServerException());
        expect(() => repository.addPiece(piece), throwsA(isA<ServerFailure>()));
        verify(mockLocalDataSource.addPiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
      });

      test("should throw a ServerError with type idNotNull when adding a piece with id != null", () {
        final piece = PieceEntity(id: "", title: "Something", composer: "Something");
        verifyZeroInteractions(mockLocalDataSource);
        expect(() => repository.addPiece(piece), throwsA(ServerFailure(type: ServerFailureTypes.idNotNullWhenAddNew)));
      });
    });

    group("removePiece()", () {
      test("should return the id of the removed piece when removing a piece", () async {
        when(mockLocalDataSource.removePiece(any)).thenAnswer((_) async => piece.id);
        final result = await repository.removePiece(piece.id);
        verify(mockLocalDataSource.removePiece(piece.id));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, equals(piece.id));
      });

      test("should throw a ServerFailure when the repository throws a LocalServerException", () {
        when(mockLocalDataSource.removePiece(any)).thenAnswer((_) async => throw LocalServerException());
        expect(() => repository.removePiece(piece.id), throwsA(isA<ServerFailure>()));
        verify(mockLocalDataSource.removePiece(piece.id));
        verifyNoMoreInteractions(mockLocalDataSource);
      });
    });

    group("updatePiece()", () {
      test("should return the local and updated piece when updating a piece", () async {
        when(mockLocalDataSource.updatePiece(any)).thenAnswer((_) async => pieceModel);
        final result = await repository.updatePiece(piece);
        verify(mockLocalDataSource.updatePiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, isA<PieceEntity>());
        expect(result, equals(piece));
      });

      test("should throw a ServerFailure when the repository throws a LocalServerException", () {
        when(mockLocalDataSource.updatePiece(any)).thenAnswer((_) async => throw LocalServerException());
        expect(() => repository.updatePiece(piece), throwsA(isA<ServerFailure>()));
        verify(mockLocalDataSource.updatePiece(pieceModel));
        verifyNoMoreInteractions(mockLocalDataSource);
      });
    });
  });
}
