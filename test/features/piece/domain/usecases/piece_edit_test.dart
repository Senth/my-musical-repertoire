import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/entities/piece_entity.dart';
import 'package:my_musical_repertoire/core/errors/error.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_edit.dart';
import '../entities/piece_test.dart';

class _MockPieceRepository extends Mock implements PieceRepository {}

void main() {
  group("Edit Piece should (#usecase #cold) ->", () {
    late PieceEdit usecase;
    late _MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = _MockPieceRepository();
      usecase = PieceEdit(mockPieceRepository);
    });

    test('Call the repository with the piece and get the piece back', () async {
      final piece = fakerPiece();
      when(mockPieceRepository.updatePiece(piece)).thenAnswer((_) async => Right(piece));

      final Either<Error, PieceEntity> result = await usecase(piece);

      expect(result, Right(piece));
      verify(mockPieceRepository.updatePiece(piece));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
