import 'package:equatable/equatable.dart';
import 'package:my_musical_repertoire/core/failures/validation_failure.dart';

abstract class Entity {
  List<ValidationInfo> validate();
}

abstract class Model {}

abstract class IdBase extends Equatable {
  final String id;

  IdBase({this.id});

  @override
  List<Object> get props {
    return [this.id];
  }
}

abstract class Piece extends IdBase {
  final String title;

  Piece({String id, this.title}) : super(id: id);

  @override
  List<Object> get props {
    return [
      ...super.props,
      this.title,
    ];
  }
}

class PieceEntity extends Piece with Entity {
  @override
  List<ValidationInfo> validate() {
    // TODO: implement validate
    throw UnimplementedError();
  }
}

class PieceModel extends Piece with Model {}
