import 'package:equatable/equatable.dart';

import 'failures/validation_failure.dart';

abstract class Entity extends Equatable {
  final String id;

  Entity(this.id);

  @override
  List<Object> get props => [this.id];

  /// Validate the entity
  /// @return all errors from validating, empty list if there are no validation errors
  List<ValidationInfo> validate() {
    final List<ValidationInfo> errors = [];

    return errors;
  }

  static validateRequired(final String field, final ValidationTypes type, final List<ValidationInfo> errors) {
    if (field == null || field.isEmpty) {
      errors.add(new ValidationInfo(type: type));
    }
  }

  @override
  bool get stringify => true;
}
