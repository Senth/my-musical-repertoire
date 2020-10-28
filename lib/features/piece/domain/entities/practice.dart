import 'package:meta/meta.dart';
import 'package:my_musical_repertoire/core/entity.dart';

class Practice extends Entity {
  final String pieceId;
  final DateTime date;
  final PracticeMistakes technicalMistakes;
  final PracticeMistakes memoryFlubs;

  Practice({
    @required id,
    @required this.pieceId,
    @required this.date,
    @required this.technicalMistakes,
    @required this.memoryFlubs,
  }) : super(id);
}

enum PracticeMistakes { none, few, some, many, everywhere }
