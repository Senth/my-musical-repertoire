// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides

part of 'validation_failure.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more informations: https://github.com/rrousselGit/freezed#custom-getters-and-methods');

/// @nodoc
class _$ValidationFailureTearOff {
  const _$ValidationFailureTearOff();

  _ValidationFailure call(List<ValidationInfo> errors) {
    return _ValidationFailure(
      errors,
    );
  }
}

/// @nodoc
const $ValidationFailure = _$ValidationFailureTearOff();

/// @nodoc
mixin _$ValidationFailure {
  List<ValidationInfo> get errors => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $ValidationFailureCopyWith<ValidationFailure> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ValidationFailureCopyWith<$Res> {
  factory $ValidationFailureCopyWith(
          ValidationFailure value, $Res Function(ValidationFailure) then) =
      _$ValidationFailureCopyWithImpl<$Res>;
  $Res call({List<ValidationInfo> errors});
}

/// @nodoc
class _$ValidationFailureCopyWithImpl<$Res>
    implements $ValidationFailureCopyWith<$Res> {
  _$ValidationFailureCopyWithImpl(this._value, this._then);

  final ValidationFailure _value;
  // ignore: unused_field
  final $Res Function(ValidationFailure) _then;

  @override
  $Res call({
    Object? errors = freezed,
  }) {
    return _then(_value.copyWith(
      errors: errors == freezed
          ? _value.errors
          : errors // ignore: cast_nullable_to_non_nullable
              as List<ValidationInfo>,
    ));
  }
}

/// @nodoc
abstract class _$ValidationFailureCopyWith<$Res>
    implements $ValidationFailureCopyWith<$Res> {
  factory _$ValidationFailureCopyWith(
          _ValidationFailure value, $Res Function(_ValidationFailure) then) =
      __$ValidationFailureCopyWithImpl<$Res>;
  @override
  $Res call({List<ValidationInfo> errors});
}

/// @nodoc
class __$ValidationFailureCopyWithImpl<$Res>
    extends _$ValidationFailureCopyWithImpl<$Res>
    implements _$ValidationFailureCopyWith<$Res> {
  __$ValidationFailureCopyWithImpl(
      _ValidationFailure _value, $Res Function(_ValidationFailure) _then)
      : super(_value, (v) => _then(v as _ValidationFailure));

  @override
  _ValidationFailure get _value => super._value as _ValidationFailure;

  @override
  $Res call({
    Object? errors = freezed,
  }) {
    return _then(_ValidationFailure(
      errors == freezed
          ? _value.errors
          : errors // ignore: cast_nullable_to_non_nullable
              as List<ValidationInfo>,
    ));
  }
}

/// @nodoc
class _$_ValidationFailure implements _ValidationFailure {
  const _$_ValidationFailure(this.errors);

  @override
  final List<ValidationInfo> errors;

  @override
  String toString() {
    return 'ValidationFailure(errors: $errors)';
  }

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other is _ValidationFailure &&
            (identical(other.errors, errors) ||
                const DeepCollectionEquality().equals(other.errors, errors)));
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ const DeepCollectionEquality().hash(errors);

  @JsonKey(ignore: true)
  @override
  _$ValidationFailureCopyWith<_ValidationFailure> get copyWith =>
      __$ValidationFailureCopyWithImpl<_ValidationFailure>(this, _$identity);
}

abstract class _ValidationFailure implements ValidationFailure {
  const factory _ValidationFailure(List<ValidationInfo> errors) =
      _$_ValidationFailure;

  @override
  List<ValidationInfo> get errors => throw _privateConstructorUsedError;
  @override
  @JsonKey(ignore: true)
  _$ValidationFailureCopyWith<_ValidationFailure> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
class _$ValidationInfoTearOff {
  const _$ValidationInfoTearOff();

  _ValidationInfo call({required ValidationTypes type, String? data}) {
    return _ValidationInfo(
      type: type,
      data: data,
    );
  }
}

/// @nodoc
const $ValidationInfo = _$ValidationInfoTearOff();

/// @nodoc
mixin _$ValidationInfo {
  ValidationTypes get type => throw _privateConstructorUsedError;
  String? get data => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $ValidationInfoCopyWith<ValidationInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ValidationInfoCopyWith<$Res> {
  factory $ValidationInfoCopyWith(
          ValidationInfo value, $Res Function(ValidationInfo) then) =
      _$ValidationInfoCopyWithImpl<$Res>;
  $Res call({ValidationTypes type, String? data});
}

/// @nodoc
class _$ValidationInfoCopyWithImpl<$Res>
    implements $ValidationInfoCopyWith<$Res> {
  _$ValidationInfoCopyWithImpl(this._value, this._then);

  final ValidationInfo _value;
  // ignore: unused_field
  final $Res Function(ValidationInfo) _then;

  @override
  $Res call({
    Object? type = freezed,
    Object? data = freezed,
  }) {
    return _then(_value.copyWith(
      type: type == freezed
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ValidationTypes,
      data: data == freezed
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
abstract class _$ValidationInfoCopyWith<$Res>
    implements $ValidationInfoCopyWith<$Res> {
  factory _$ValidationInfoCopyWith(
          _ValidationInfo value, $Res Function(_ValidationInfo) then) =
      __$ValidationInfoCopyWithImpl<$Res>;
  @override
  $Res call({ValidationTypes type, String? data});
}

/// @nodoc
class __$ValidationInfoCopyWithImpl<$Res>
    extends _$ValidationInfoCopyWithImpl<$Res>
    implements _$ValidationInfoCopyWith<$Res> {
  __$ValidationInfoCopyWithImpl(
      _ValidationInfo _value, $Res Function(_ValidationInfo) _then)
      : super(_value, (v) => _then(v as _ValidationInfo));

  @override
  _ValidationInfo get _value => super._value as _ValidationInfo;

  @override
  $Res call({
    Object? type = freezed,
    Object? data = freezed,
  }) {
    return _then(_ValidationInfo(
      type: type == freezed
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as ValidationTypes,
      data: data == freezed
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
class _$_ValidationInfo implements _ValidationInfo {
  const _$_ValidationInfo({required this.type, this.data});

  @override
  final ValidationTypes type;
  @override
  final String? data;

  @override
  String toString() {
    return 'ValidationInfo(type: $type, data: $data)';
  }

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other is _ValidationInfo &&
            (identical(other.type, type) ||
                const DeepCollectionEquality().equals(other.type, type)) &&
            (identical(other.data, data) ||
                const DeepCollectionEquality().equals(other.data, data)));
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      const DeepCollectionEquality().hash(type) ^
      const DeepCollectionEquality().hash(data);

  @JsonKey(ignore: true)
  @override
  _$ValidationInfoCopyWith<_ValidationInfo> get copyWith =>
      __$ValidationInfoCopyWithImpl<_ValidationInfo>(this, _$identity);
}

abstract class _ValidationInfo implements ValidationInfo {
  const factory _ValidationInfo({required ValidationTypes type, String? data}) =
      _$_ValidationInfo;

  @override
  ValidationTypes get type => throw _privateConstructorUsedError;
  @override
  String? get data => throw _privateConstructorUsedError;
  @override
  @JsonKey(ignore: true)
  _$ValidationInfoCopyWith<_ValidationInfo> get copyWith =>
      throw _privateConstructorUsedError;
}
