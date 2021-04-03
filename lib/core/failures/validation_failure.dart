import 'package:freezed_annotation/freezed_annotation.dart';
import 'failure.dart';

part 'validation_failure.freezed.dart';

@freezed
class ValidationFailure with _$ValidationFailure implements Failure {
  const factory ValidationFailure(List<ValidationInfo> errors) = _ValidationFailure;
}

@freezed
class ValidationInfo with _$ValidationInfo {
  const factory ValidationInfo({
    required ValidationTypes type,
    String? data,
  }) = _ValidationInfo;
}

enum ValidationTypes {
  undefined,
  dateIsInTheFuture,
  titleRequired,
  composerRequired,
}
