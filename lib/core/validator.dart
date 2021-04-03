import 'failures/validation_failure.dart';

class Validator {
  static required(final String? field, final ValidationTypes type, final List<ValidationInfo> errors) {
    if (field == null || field.isEmpty) {
      errors.add(ValidationInfo(type: type));
    }
  }

  /// Make sure the date is not in the future
  static dateNotInFuture(final DateTime date, final List<ValidationInfo> errors) {
    if (date.isAfter(DateTime.now())) {
      errors.add(ValidationInfo(type: ValidationTypes.dateIsInTheFuture));
    }
  }
}
