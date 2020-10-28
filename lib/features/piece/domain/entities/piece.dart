import 'package:meta/meta.dart';
import 'package:my_musical_repertoire/core/entity.dart';

class Piece extends Entity {
  final String name;
  final DateTime lastPracticed;

  Piece({
    @required id,
    @required this.name,
    @required this.lastPracticed,
  }) : super(id);
}
