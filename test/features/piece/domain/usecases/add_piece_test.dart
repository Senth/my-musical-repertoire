import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:faker/faker.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_add.dart';

import '../entities/piece_test.dart';

const faker = Faker();

class _MockPieceRepository extends Mock implements PieceRepository {}

void main() {
  group("AddPiece #usecase #cold", () {
    PieceAdd usecase;
    _MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = _MockPieceRepository();
      usecase = PieceAdd(mockPieceRepository);
    });

    test('Should add piece', () async {
      final piece = fakerPiece();
      when(mockPieceRepository.addPiece(any))
          .thenAnswer((_) async => Right(piece));

      final result = await usecase.execute(piece);

      expect(result, Right(piece));
      verify(mockPieceRepository.addPiece(piece));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
