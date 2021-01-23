import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_remove.dart';

class _MockPieceRepository extends Mock implements PieceRepository {}

void main() {
  group("Remove Piece should (#usecase #cold) ->", () {
    PieceRemove usecase;
    _MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = _MockPieceRepository();
      usecase = PieceRemove(mockPieceRepository);
    });

    test('Call the repository to remove the piece with the specified id', () async {
      final String id = "9af5b94b-509d-47f2-a774-634c6e6d7902";
      when(mockPieceRepository.removePiece(any)).thenAnswer((_) async => Right(id));

      final result = await usecase(id);

      expect(result, Right(id));
      verify(mockPieceRepository.removePiece(id));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
