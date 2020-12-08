import 'package:meta/meta.dart';
import 'package:my_musical_repertoire/core/entity.dart';
import 'package:my_musical_repertoire/core/errors/validation_error.dart';

class Practice extends Entity {
  final String pieceId;
  final DateTime date;
  final PracticeMistakes technicalMistakes;
  final PracticeMistakes memoryFlubs;

  Practice({
    @required String id,
    @required this.pieceId,
    @required this.date,
    @required this.technicalMistakes,
    @required this.memoryFlubs,
  }) : super(id);

  @override
  List<Object> get props {
    final List<Object> props = super.props;

    props.add([
      this.pieceId,
      this.date,
      this.technicalMistakes,
      this.memoryFlubs,
    ]);

    return props;
  }

  @override
  List<ValidationInfo> validate() {
    final errors = super.validate();

    // pieceId
    Entity.validateId(this.pieceId, errors);

    // Date should not be in the future
    if (this.date.isAfter(new DateTime.now())) {
      errors.add(new ValidationInfo(type: ValidationTypes.dateIsInTheFuture));
    }

    return errors;
  }

  Practice copy({
    String id,
    String pieceId,
    DateTime date,
    PracticeMistakes technicalMistakes,
    PracticeMistakes memoryFlubs,
  }) {
    return new Practice(
      id: id != null ? id : this.id,
      pieceId: pieceId != null ? pieceId : this.pieceId,
      date: date != null ? date : this.date,
      technicalMistakes: technicalMistakes != null
          ? technicalMistakes
          : this.technicalMistakes,
      memoryFlubs: memoryFlubs != null ? memoryFlubs : this.memoryFlubs,
    );
  }
}

enum PracticeMistakes { none, few, some, many, everywhere }
