import 'package:equatable/equatable.dart';
import 'failure.dart';

class ValidationFailure extends Failure {
  final List<ValidationInfo> errors;

  ValidationFailure(this.errors);

  @override
  List<Object> get props => [this.errors];
}

class ValidationInfo extends Equatable {
  final ValidationTypes type;
  final String? data;

  ValidationInfo({required this.type, this.data});

  @override
  List<Object?> get props => [this.type, this.data];

  @override
  bool get stringify => true;
}

enum ValidationTypes {
  undefined,
  dateIsInTheFuture,
  titleRequired,
  composerRequired,
}
