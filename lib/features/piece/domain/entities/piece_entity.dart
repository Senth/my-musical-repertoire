import 'package:meta/meta.dart';
import 'package:json_annotation/json_annotation.dart';

import '../../../../core/entity.dart';
import '../../../../core/failures/validation_failure.dart';

part 'piece_entity.g.dart';

@JsonSerializable()
class PieceEntity extends Entity {
  final String title;
  final String composer;
  final DateTime lastPracticed;

  PieceEntity({
    String id,
    @required this.title,
    @required this.composer,
    this.lastPracticed,
  }) : super(id);

  factory PieceEntity.fromJson(Map<String, dynamic> json) => _$PieceEntityFromJson(json);
  Map<String, dynamic> toJson() => _$PieceEntityToJson(this);

  @override
  List<Object> get props {
    return [
      ...super.props,
      this.title,
      this.composer,
      this.lastPracticed,
    ];
  }

  @override
  List<ValidationInfo> validate() {
    final errors = super.validate();

    // Name is too short
    Entity.validateRequired(this.title, ValidationTypes.titleRequired, errors);

    // Title too short
    Entity.validateRequired(this.composer, ValidationTypes.composerRequired, errors);

    // Date should not be in the future
    if (this.lastPracticed.isAfter(new DateTime.now())) {
      errors.add(new ValidationInfo(type: ValidationTypes.dateIsInTheFuture));
    }

    return errors;
  }

  /// Create a copy of the piece, overriding some elements
  /// It's not possible to unset elements, you have to do that after the .copy()
  /// method is called. When passing in null, it will use this value instead.
  /// @return copy of this piece
  PieceEntity copy({
    String id,
    String title,
    String composer,
    DateTime lastPracticed,
  }) {
    return new PieceEntity(
      id: id != null ? id : this.id,
      title: title != null ? title : this.title,
      composer: composer != null ? composer : this.composer,
      lastPracticed: lastPracticed != null ? lastPracticed : this.lastPracticed,
    );
  }
}
