// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides

part of 'piece_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more informations: https://github.com/rrousselGit/freezed#custom-getters-and-methods');

PieceEntity _$PieceEntityFromJson(Map<String, dynamic> json) {
  return _PieceEntity.fromJson(json);
}

/// @nodoc
class _$PieceEntityTearOff {
  const _$PieceEntityTearOff();

  _PieceEntity call(
      {String? id,
      required String title,
      required String composer,
      DateTime? lastPracticed}) {
    return _PieceEntity(
      id: id,
      title: title,
      composer: composer,
      lastPracticed: lastPracticed,
    );
  }

  PieceEntity fromJson(Map<String, Object> json) {
    return PieceEntity.fromJson(json);
  }
}

/// @nodoc
const $PieceEntity = _$PieceEntityTearOff();

/// @nodoc
mixin _$PieceEntity {
  String? get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get composer => throw _privateConstructorUsedError;
  DateTime? get lastPracticed => throw _privateConstructorUsedError;

  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;
  @JsonKey(ignore: true)
  $PieceEntityCopyWith<PieceEntity> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PieceEntityCopyWith<$Res> {
  factory $PieceEntityCopyWith(
          PieceEntity value, $Res Function(PieceEntity) then) =
      _$PieceEntityCopyWithImpl<$Res>;
  $Res call(
      {String? id, String title, String composer, DateTime? lastPracticed});
}

/// @nodoc
class _$PieceEntityCopyWithImpl<$Res> implements $PieceEntityCopyWith<$Res> {
  _$PieceEntityCopyWithImpl(this._value, this._then);

  final PieceEntity _value;
  // ignore: unused_field
  final $Res Function(PieceEntity) _then;

  @override
  $Res call({
    Object? id = freezed,
    Object? title = freezed,
    Object? composer = freezed,
    Object? lastPracticed = freezed,
  }) {
    return _then(_value.copyWith(
      id: id == freezed
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      title: title == freezed
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      composer: composer == freezed
          ? _value.composer
          : composer // ignore: cast_nullable_to_non_nullable
              as String,
      lastPracticed: lastPracticed == freezed
          ? _value.lastPracticed
          : lastPracticed // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
abstract class _$PieceEntityCopyWith<$Res>
    implements $PieceEntityCopyWith<$Res> {
  factory _$PieceEntityCopyWith(
          _PieceEntity value, $Res Function(_PieceEntity) then) =
      __$PieceEntityCopyWithImpl<$Res>;
  @override
  $Res call(
      {String? id, String title, String composer, DateTime? lastPracticed});
}

/// @nodoc
class __$PieceEntityCopyWithImpl<$Res> extends _$PieceEntityCopyWithImpl<$Res>
    implements _$PieceEntityCopyWith<$Res> {
  __$PieceEntityCopyWithImpl(
      _PieceEntity _value, $Res Function(_PieceEntity) _then)
      : super(_value, (v) => _then(v as _PieceEntity));

  @override
  _PieceEntity get _value => super._value as _PieceEntity;

  @override
  $Res call({
    Object? id = freezed,
    Object? title = freezed,
    Object? composer = freezed,
    Object? lastPracticed = freezed,
  }) {
    return _then(_PieceEntity(
      id: id == freezed
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String?,
      title: title == freezed
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      composer: composer == freezed
          ? _value.composer
          : composer // ignore: cast_nullable_to_non_nullable
              as String,
      lastPracticed: lastPracticed == freezed
          ? _value.lastPracticed
          : lastPracticed // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

@JsonSerializable()

/// @nodoc
class _$_PieceEntity extends _PieceEntity {
  const _$_PieceEntity(
      {this.id,
      required this.title,
      required this.composer,
      this.lastPracticed})
      : super._();

  factory _$_PieceEntity.fromJson(Map<String, dynamic> json) =>
      _$_$_PieceEntityFromJson(json);

  @override
  final String? id;
  @override
  final String title;
  @override
  final String composer;
  @override
  final DateTime? lastPracticed;

  @override
  String toString() {
    return 'PieceEntity(id: $id, title: $title, composer: $composer, lastPracticed: $lastPracticed)';
  }

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other is _PieceEntity &&
            (identical(other.id, id) ||
                const DeepCollectionEquality().equals(other.id, id)) &&
            (identical(other.title, title) ||
                const DeepCollectionEquality().equals(other.title, title)) &&
            (identical(other.composer, composer) ||
                const DeepCollectionEquality()
                    .equals(other.composer, composer)) &&
            (identical(other.lastPracticed, lastPracticed) ||
                const DeepCollectionEquality()
                    .equals(other.lastPracticed, lastPracticed)));
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      const DeepCollectionEquality().hash(id) ^
      const DeepCollectionEquality().hash(title) ^
      const DeepCollectionEquality().hash(composer) ^
      const DeepCollectionEquality().hash(lastPracticed);

  @JsonKey(ignore: true)
  @override
  _$PieceEntityCopyWith<_PieceEntity> get copyWith =>
      __$PieceEntityCopyWithImpl<_PieceEntity>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$_$_PieceEntityToJson(this);
  }
}

abstract class _PieceEntity extends PieceEntity {
  const factory _PieceEntity(
      {String? id,
      required String title,
      required String composer,
      DateTime? lastPracticed}) = _$_PieceEntity;
  const _PieceEntity._() : super._();

  factory _PieceEntity.fromJson(Map<String, dynamic> json) =
      _$_PieceEntity.fromJson;

  @override
  String? get id => throw _privateConstructorUsedError;
  @override
  String get title => throw _privateConstructorUsedError;
  @override
  String get composer => throw _privateConstructorUsedError;
  @override
  DateTime? get lastPracticed => throw _privateConstructorUsedError;
  @override
  @JsonKey(ignore: true)
  _$PieceEntityCopyWith<_PieceEntity> get copyWith =>
      throw _privateConstructorUsedError;
}
