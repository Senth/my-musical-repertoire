import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:my_musical_repertoire/core/validator.dart';

import '../../../../core/failures/validation_failure.dart';

part 'piece_entity.g.dart';
part 'piece_entity.freezed.dart';

@freezed
class PieceEntity with _$PieceEntity {
  const PieceEntity._();
  const factory PieceEntity({
    String? id,
    required String title,
    required String composer,
    DateTime? lastPracticed,
  }) = _PieceEntity;

  factory PieceEntity.fromJson(Map<String, dynamic> json) => _$PieceEntityFromJson(json);

  List<ValidationInfo> validate() {
    final List<ValidationInfo> errors = [];

    // Name is too short
    Validator.required(this.title, ValidationTypes.titleRequired, errors);

    // Title too short
    Validator.required(this.composer, ValidationTypes.composerRequired, errors);

    // Date should not be in the future
    if (this.lastPracticed!.isAfter(new DateTime.now())) {
      errors.add(new ValidationInfo(type: ValidationTypes.dateIsInTheFuture));
    }

    return errors;
  }
}
