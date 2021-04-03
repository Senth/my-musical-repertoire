// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides

part of 'practice_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more informations: https://github.com/rrousselGit/freezed#custom-getters-and-methods');

PracticeEntity _$PracticeEntityFromJson(Map<String, dynamic> json) {
  return _PracticeEntity.fromJson(json);
}

/// @nodoc
class _$PracticeEntityTearOff {
  const _$PracticeEntityTearOff();

  _PracticeEntity call(
      {String? id,
      required String pieceId,
      required DateTime date,
      required PracticeMistakes technicalMistakes,
      required PracticeMistakes memoryFlubs}) {
    return _PracticeEntity(
      id: id,
      pieceId: pieceId,
      date: date,
      technicalMistakes: technicalMistakes,
      memoryFlubs: memoryFlubs,
    );
  }

  PracticeEntity fromJson(Map<String, Object> json) {
    return PracticeEntity.fromJson(json);
  }
}

/// @nodoc
const $PracticeEntity = _$PracticeEntityTearOff();

/// @nodoc
mixin _$PracticeEntity {
  String? get id => throw _privateConstructorUsedError;
  String get pieceId => throw _privateConstructorUsedError;
  DateTime get date => throw _privateConstructorUsedError;
  PracticeMistakes get technicalMistakes => throw _privateConstructorUsedError;
  PracticeMistakes get memoryFlubs => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $PracticeEntityCopyWith<PracticeEntity> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PracticeEntityCopyWith<$Res> {
  factory $PracticeEntityCopyWith(
          PracticeEntity value, $Res Function(PracticeEntity) then) =
      _$PracticeEntityCopyWithImpl<$Res>;
  $Res call(
      {String? id,
      String pieceId,
      DateTime date,
      PracticeMistakes technicalMistakes,
      PracticeMistakes memoryFlubs});
}

/// @nodoc
class _$PracticeEntityCopyWithImpl<$Res>
    implements $PracticeEntityCopyWith<$Res> {
  _$PracticeEntityCopyWithImpl(this._value, this._then);

  final PracticeEntity _value;
  // ignore: unused_field
  final $Res Function(PracticeEntity) _then;

  @override
  $Res call({
    Object? id = freezed,
    Object? pieceId = freezed,
    Object? date = freezed,
    Object? technicalMistakes = freezed,
    Object? memoryFlubs = freezed,
  }) {
    return _then(_value.copyWith(
      id: id == freezed
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      pieceId: pieceId == freezed
          ? _value.pieceId
          : pieceId // ignore: cast_nullable_to_non_nullable
              as String,
      date: date == freezed
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as DateTime,
      technicalMistakes: technicalMistakes == freezed
          ? _value.technicalMistakes
          : technicalMistakes // ignore: cast_nullable_to_non_nullable
              as PracticeMistakes,
      memoryFlubs: memoryFlubs == freezed
          ? _value.memoryFlubs
          : memoryFlubs // ignore: cast_nullable_to_non_nullable
              as PracticeMistakes,
    ));
  }
}

/// @nodoc
abstract class _$PracticeEntityCopyWith<$Res>
    implements $PracticeEntityCopyWith<$Res> {
  factory _$PracticeEntityCopyWith(
          _PracticeEntity value, $Res Function(_PracticeEntity) then) =
      __$PracticeEntityCopyWithImpl<$Res>;
  @override
  $Res call(
      {String? id,
      String pieceId,
      DateTime date,
      PracticeMistakes technicalMistakes,
      PracticeMistakes memoryFlubs});
}

/// @nodoc
class __$PracticeEntityCopyWithImpl<$Res>
    extends _$PracticeEntityCopyWithImpl<$Res>
    implements _$PracticeEntityCopyWith<$Res> {
  __$PracticeEntityCopyWithImpl(
      _PracticeEntity _value, $Res Function(_PracticeEntity) _then)
      : super(_value, (v) => _then(v as _PracticeEntity));

  @override
  _PracticeEntity get _value => super._value as _PracticeEntity;

  @override
  $Res call({
    Object? id = freezed,
    Object? pieceId = freezed,
    Object? date = freezed,
    Object? technicalMistakes = freezed,
    Object? memoryFlubs = freezed,
  }) {
    return _then(_PracticeEntity(
      id: id == freezed
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      pieceId: pieceId == freezed
          ? _value.pieceId
          : pieceId // ignore: cast_nullable_to_non_nullable
              as String,
      date: date == freezed
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as DateTime,
      technicalMistakes: technicalMistakes == freezed
          ? _value.technicalMistakes
          : technicalMistakes // ignore: cast_nullable_to_non_nullable
              as PracticeMistakes,
      memoryFlubs: memoryFlubs == freezed
          ? _value.memoryFlubs
          : memoryFlubs // ignore: cast_nullable_to_non_nullable
              as PracticeMistakes,
    ));
  }
}

@JsonSerializable()

/// @nodoc
class _$_PracticeEntity extends _PracticeEntity {
  const _$_PracticeEntity(
      {this.id,
      required this.pieceId,
      required this.date,
      required this.technicalMistakes,
      required this.memoryFlubs})
      : super._();

  factory _$_PracticeEntity.fromJson(Map<String, dynamic> json) =>
      _$_$_PracticeEntityFromJson(json);

  @override
  final String? id;
  @override
  final String pieceId;
  @override
  final DateTime date;
  @override
  final PracticeMistakes technicalMistakes;
  @override
  final PracticeMistakes memoryFlubs;

  @override
  String toString() {
    return 'PracticeEntity(id: $id, pieceId: $pieceId, date: $date, technicalMistakes: $technicalMistakes, memoryFlubs: $memoryFlubs)';
  }

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other is _PracticeEntity &&
            (identical(other.id, id) ||
                const DeepCollectionEquality().equals(other.id, id)) &&
            (identical(other.pieceId, pieceId) ||
                const DeepCollectionEquality()
                    .equals(other.pieceId, pieceId)) &&
            (identical(other.date, date) ||
                const DeepCollectionEquality().equals(other.date, date)) &&
            (identical(other.technicalMistakes, technicalMistakes) ||
                const DeepCollectionEquality()
                    .equals(other.technicalMistakes, technicalMistakes)) &&
            (identical(other.memoryFlubs, memoryFlubs) ||
                const DeepCollectionEquality()
                    .equals(other.memoryFlubs, memoryFlubs)));
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      const DeepCollectionEquality().hash(id) ^
      const DeepCollectionEquality().hash(pieceId) ^
      const DeepCollectionEquality().hash(date) ^
      const DeepCollectionEquality().hash(technicalMistakes) ^
      const DeepCollectionEquality().hash(memoryFlubs);

  @JsonKey(ignore: true)
  @override
  _$PracticeEntityCopyWith<_PracticeEntity> get copyWith =>
      __$PracticeEntityCopyWithImpl<_PracticeEntity>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$_$_PracticeEntityToJson(this);
  }
}

abstract class _PracticeEntity extends PracticeEntity {
  const factory _PracticeEntity(
      {String? id,
      required String pieceId,
      required DateTime date,
      required PracticeMistakes technicalMistakes,
      required PracticeMistakes memoryFlubs}) = _$_PracticeEntity;
  const _PracticeEntity._() : super._();

  factory _PracticeEntity.fromJson(Map<String, dynamic> json) =
      _$_PracticeEntity.fromJson;

  @override
  String? get id => throw _privateConstructorUsedError;
  @override
  String get pieceId => throw _privateConstructorUsedError;
  @override
  DateTime get date => throw _privateConstructorUsedError;
  @override
  PracticeMistakes get technicalMistakes => throw _privateConstructorUsedError;
  @override
  PracticeMistakes get memoryFlubs => throw _privateConstructorUsedError;
  @override
  @JsonKey(ignore: true)
  _$PracticeEntityCopyWith<_PracticeEntity> get copyWith =>
      throw _privateConstructorUsedError;
}
