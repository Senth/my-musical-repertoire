import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:faker/faker.dart';
import 'package:mockito/mockito.dart';
import 'package:my_musical_repertoire/features/piece/domain/repositories/piece_repository.dart';
import 'package:my_musical_repertoire/features/piece/domain/usecases/piece_edit.dart';
import '../entities/piece_test.dart';

const faker = Faker();

class _MockPieceRepository extends Mock implements PieceRepository {}

void main() {
  group("PieceEdit #usecase #cold", () {
    PieceEdit usecase;
    _MockPieceRepository mockPieceRepository;

    setUp(() {
      mockPieceRepository = _MockPieceRepository();
      usecase = PieceEdit(mockPieceRepository);
    });

    test('Should edit a piece', () async {
      final piece = fakerPiece();
      when(mockPieceRepository.updatePiece(piece))
          .thenAnswer((_) async => Right(piece));

      final result = await usecase(piece);

      expect(result, Right(piece));
      verify(mockPieceRepository.updatePiece(piece));
      verifyNoMoreInteractions(mockPieceRepository);
    });
  });
}
