import 'package:meta/meta.dart';
import 'package:my_musical_repertoire/core/entity.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';

class Piece extends Entity {
  final String name;
  final DateTime lastPracticed;

  Piece({
    @required id,
    @required this.name,
    @required this.lastPracticed,
  }) : super(id);

  @override
  List<Object> get props {
    final List<Object> props = super.props;

    props.add([
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
  Piece copy({
    id,
    name,
    lastPracticed,
  }) {
    return new Piece(
      id: id != null ? id : this.id,
      name: name != null ? name : this.name,
      lastPracticed: lastPracticed != null ? lastPracticed : this.lastPracticed,
    );
  }
}
