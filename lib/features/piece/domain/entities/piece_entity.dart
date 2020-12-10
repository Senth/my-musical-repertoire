import 'package:meta/meta.dart';

import '../../../../core/entity.dart';
import '../../../../core/errors/validation_error.dart';

class PieceEntity extends Entity {
  final String name;
  final DateTime lastPracticed;

  PieceEntity({
    @required String id,
    @required this.name,
    this.lastPracticed,
  }) : super(id);

  @override
  List<Object> get props {
    final List<Object> props = super.props;

    props.addAll([
      this.name,
      this.lastPracticed,
    ]);

    return props;
  }

  @override
  List<ValidationInfo> validate() {
    final errors = super.validate();

    // Name is too short
    Entity.validateName(this.name, errors);

    // Date should not be in the future
    if (this.lastPracticed.isAfter(new DateTime.now())) {
      errors.add(new ValidationInfo(type: ValidationTypes.dateIsInTheFuture));
    }

    return errors;
  }

  /// Create a copy of the piece, overriding some elements
  /// @return copy of this piece
  PieceEntity copy({
    id,
    name,
    lastPracticed,
  }) {
    return new PieceEntity(
      id: id != null ? id : this.id,
      name: name != null ? name : this.name,
      lastPracticed: lastPracticed != null ? lastPracticed : this.lastPracticed,
    );
  }
}
