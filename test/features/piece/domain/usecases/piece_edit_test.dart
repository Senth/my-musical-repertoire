import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_edit.dart';
import '../entities/piece_test.dart';

class _MockPieceRepository extends Mock implements PieceRepository {}

void main() {
  group("Edit Piece should (#usecase #cold) ->", () {
    PieceEdit usecase;
    _MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = _MockPieceRepository();
      usecase = PieceEdit(mockPieceRepository);
    });

    test('Call the repository with the piece and get the piece back', () async {
      final piece = fakerPiece();
      when(mockPieceRepository.updatePiece(any)).thenAnswer((_) async => piece);

      final result = await usecase(piece);

      expect(result, Right(piece));
      verify(mockPieceRepository.updatePiece(piece));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
