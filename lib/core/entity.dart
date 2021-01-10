import 'package:equatable/equatable.dart';
import 'consts.dart';

import 'errors/validation_error.dart';

abstract class Entity extends Equatable {
  final String? id;

  Entity(this.id);

  @override
  List<Object?> get props => [this.id];

  /// Validate the entity
  /// @return all errors from validating, empty list if there are no validation errors
  List<ValidationInfo> validate() {
    final List<ValidationInfo> errors = [];

    validateId(this.id, errors);

    return errors;
  }

  static validateId(final String? id, final List<ValidationInfo> errors) {
    if (id == null) {
      errors.add(new ValidationInfo(type: ValidationTypes.idNotDefined));
    } else if (id == '') {
      errors.add(new ValidationInfo(type: ValidationTypes.idIsEmpty));
    }
  }

  static validateName(final String? name, final List<ValidationInfo> errors) {
    if (name == null || name.length < ValidationConsts.nameLengthMin) {
      errors.add(new ValidationInfo(
        type: ValidationTypes.nameTooShort,
        data: ValidationConsts.nameLengthMin.toString(),
      ));
    }
  }

  @override
  bool get stringify => true;
}
