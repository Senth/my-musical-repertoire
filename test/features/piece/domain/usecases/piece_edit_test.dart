import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/core/failures/failure.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_edit.dart';
import '../entities/piece_entity_test.dart';
import 'piece_add_test.mocks.dart';

void main() {
  group("Edit Piece should (#usecase #cold) ->", () {
    late PieceEdit usecase;
    late MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = MockPieceRepository();
      usecase = PieceEdit(mockPieceRepository);
    });

    test('Call the repository with the piece and get the piece back', () async {
      final piece = fakerPiece();
      when(mockPieceRepository.updatePiece(any)).thenAnswer((_) async => piece);

      final Either<Failure, PieceEntity> result = await usecase(piece);

      expect(result, Right(piece));
      verify(mockPieceRepository.updatePiece(piece));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
