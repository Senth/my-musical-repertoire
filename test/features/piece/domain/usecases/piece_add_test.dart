import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/core/failures/failure.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_add.dart';

import '../entities/piece_entity_test.dart';
import 'piece_add_test.mocks.dart';

@GenerateMocks([PieceRepository])
void main() {
  group("Add Piece should (#usecase #cold) ->", () {
    late PieceAdd usecase;
    late MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = MockPieceRepository();
      usecase = PieceAdd(mockPieceRepository);
    });

    test('Call the repository with the piece and get the piece back', () async {
      final piece = fakerPiece();
      when(mockPieceRepository.addPiece(any)).thenAnswer((_) async => piece);

      final Either<Failure, PieceEntity> result = await usecase(piece);

      expect(result, Right(piece));
      verify(mockPieceRepository.addPiece(piece));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
