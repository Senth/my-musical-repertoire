import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/core/failures/exceptions.dart';
import 'package:my_musical_repertoire/core/failures/server_failure.dart';
import 'package:my_musical_repertoire/features/piece/data/datasources/piece_local_data_source.dart';
import 'package:my_musical_repertoire/features/piece/data/repositories/piece_repository_impl.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';

class MockLocalDataSource extends Mock implements PieceLocalDataSource {}

void main() {
  group("PieceRepositoryImpl (#repository #cold) ->", () {
    late PieceRepositoryImpl repository;
    MockLocalDataSource? mockLocalDataSource;
    final piece = PieceEntity(id: null, title: "Test name", composer: "Composer");

    setUp(() {
      mockLocalDataSource = MockLocalDataSource();
      repository = PieceRepositoryImpl(localDataSource: mockLocalDataSource);
    });

    group("addPiece()", () {
      test("should return the local and updated piece when adding a piece", () async {
        final piece = PieceEntity(id: null, title: "Test name", composer: "Composer");
        when(mockLocalDataSource!.add(any!)).thenAnswer((_) async => piece);

        final result = await repository.addPiece(piece);

        verify(mockLocalDataSource!.add(piece));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, isA<PieceEntity>());
        expect(result, equals(PieceEntity(id: piece.id, title: piece.title, composer: piece.composer)));
      });

      test("should throw a ServerFailure when the repository throws a LocalServerException", () {
        when(mockLocalDataSource!.add(any!)).thenAnswer(((_) async => throw LocalServerException()) as Future<PieceEntity> Function(Invocation));
        expect(() => repository.addPiece(piece), throwsA(isA<ServerFailure>()));
        verify(mockLocalDataSource!.add(piece));
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
        when(mockLocalDataSource!.remove(any)).thenAnswer((_) async => piece.id);
        final result = await repository.removePiece(piece.id);
        verify(mockLocalDataSource!.remove(piece.id));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, equals(piece.id));
      });

      test("should throw a ServerFailure when the repository throws a LocalServerException", () {
        when(mockLocalDataSource!.remove(any)).thenAnswer((_) async => throw LocalServerException());
        expect(() => repository.removePiece(piece.id), throwsA(isA<ServerFailure>()));
        verify(mockLocalDataSource!.remove(piece.id));
        verifyNoMoreInteractions(mockLocalDataSource);
      });
    });

    group("updatePiece()", () {
      test("should return the local and updated piece when updating a piece", () async {
        when(mockLocalDataSource!.update(any!)).thenAnswer((_) async => piece);
        final result = await repository.updatePiece(piece);
        verify(mockLocalDataSource!.update(piece));
        verifyNoMoreInteractions(mockLocalDataSource);
        expect(result, isA<PieceEntity>());
        expect(result, equals(piece));
      });

      test("should throw a ServerFailure when the repository throws a LocalServerException", () {
        when(mockLocalDataSource!.update(any!)).thenAnswer(((_) async => throw LocalServerException()) as Future<PieceEntity> Function(Invocation));
        expect(() => repository.updatePiece(piece), throwsA(isA<ServerFailure>()));
        verify(mockLocalDataSource!.update(piece));
        verifyNoMoreInteractions(mockLocalDataSource);
      });
    });

    group("getPieces()", () {
      test("should return all pieces from the repository", () async {
        final List<List<PieceEntity>> testData = [
          [
            PieceEntity(id: "1", title: "Moonlight", composer: "Beethoven"),
            PieceEntity(id: "2", title: "Turca", composer: "Mozart"),
          ],
          [],
        ];

        for (final test in testData) {
          when(mockLocalDataSource!.getAll()).thenAnswer((_) async => test);
          final result = await repository.getPieces();
          verify(mockLocalDataSource!.getAll());
          expect(result, test);
        }
      });

      test("should throw a ServerFailure when the repository throws a LocalServerException", () {
        when(mockLocalDataSource!.getAll()).thenAnswer(((_) => throw LocalServerException()) as Future<List<PieceEntity>> Function(Invocation));
        expect(() => repository.getPieces(), throwsA(isA<ServerFailure>()));
        verify(mockLocalDataSource!.getAll());
        verifyNoMoreInteractions(mockLocalDataSource);
      });
    });
  });
}
