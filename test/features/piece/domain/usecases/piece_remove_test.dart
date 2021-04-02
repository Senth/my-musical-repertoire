import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_remove.dart';

import 'piece_add_test.mocks.dart';

void main() {
  group("Remove Piece should (#usecase #cold) ->", () {
    late PieceRemove usecase;
    late MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = MockPieceRepository();
      usecase = PieceRemove(mockPieceRepository);
    });

    test('Call the repository to remove the piece with the specified id', () async {
      final String id = "9af5b94b-509d-47f2-a774-634c6e6d7902";
      when(mockPieceRepository.removePiece(any)).thenAnswer((_) async => id);

      final result = await (usecase(id));

      expect(result, Right(id));
      verify(mockPieceRepository.removePiece(id));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
