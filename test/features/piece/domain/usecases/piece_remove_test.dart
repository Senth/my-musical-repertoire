import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:faker/faker.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_remove.dart';

const faker = Faker();

class _MockPieceRepository extends Mock implements PieceRepository {}

void main() {
  group("PieceRemove #usecase #cold", () {
    PieceRemove usecase;
    _MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = _MockPieceRepository();
      usecase = PieceRemove(mockPieceRepository);
    });

    test('Should remove a piece', () async {
      final String id = faker.guid.guid();
      when(mockPieceRepository.removePiece(any))
          .thenAnswer((_) async => Right(id));

      final result = await usecase(id);

      expect(result, Right(id));
      verify(mockPieceRepository.removePiece(id));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
