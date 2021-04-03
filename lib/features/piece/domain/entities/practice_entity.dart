import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../../core/validator.dart';

import '../../../../core/failures/validation_failure.dart';

part 'practice_entity.freezed.dart';
part 'practice_entity.g.dart';

@freezed
class PracticeEntity with _$PracticeEntity {
  const PracticeEntity._();
  const factory PracticeEntity({
    String? id,
    required String pieceId,
    required DateTime date,
    required PracticeMistakes technicalMistakes,
    required PracticeMistakes memoryFlubs,
  }) = _PracticeEntity;
  factory PracticeEntity.fromJson(Map<String, dynamic> json) => _$PracticeEntityFromJson(json);

  List<ValidationInfo> validate() {
    final List<ValidationInfo> errors = [];

    // Date should not be in the future
    Validator.dateNotInFuture(this.date, errors);

    return errors;
  }
}

enum PracticeMistakes {
  none,
  few,
  some,
  many,
  everywhere,
}
