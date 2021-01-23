import 'package:equatable/equatable.dart';
import 'package:meta/meta.dart';
import 'error.dart';

class ValidationError extends Error {
  final List<ValidationInfo> errors;

  ValidationError(this.errors);

  @override
  List<Object> get props => [this.errors];
}

class ValidationInfo extends Equatable {
  final ValidationTypes type;
  final String data;

  ValidationInfo({@required this.type, this.data});

  @override
  List<Object> get props => [this.type, this.data];

  @override
  bool get stringify => true;
}

enum ValidationTypes {
  undefined,
  dateIsInTheFuture,
  idNotDefined,
  nameTooShort,
}
