import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_add.dart';

import '../entities/piece_entity_test.dart';

class _MockPieceRepository extends Mock implements PieceRepository {}

void main() {
  group("Add Piece should (#usecase #cold) ->", () {
    late PieceAdd usecase;
    _MockPieceRepository? mockPieceRepository;

    setUp(() {
      mockPieceRepository = _MockPieceRepository();
      usecase = PieceAdd(mockPieceRepository);
    });

    test('Call the repository with the piece and get the piece back', () async {
      final piece = fakerPiece();
      when(mockPieceRepository!.addPiece(any!)).thenAnswer((_) async => piece);

      final Either<Failure, PieceEntity>? result = await usecase(piece);

      expect(result, Right(piece));
      verify(mockPieceRepository!.addPiece(piece));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
