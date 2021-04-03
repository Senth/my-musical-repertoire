// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'practice_entity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$_PracticeEntity _$_$_PracticeEntityFromJson(Map<String, dynamic> json) {
  return _$_PracticeEntity(
    id: json['id'] as String?,
    pieceId: json['pieceId'] as String,
    date: DateTime.parse(json['date'] as String),
    technicalMistakes:
        _$enumDecode(_$PracticeMistakesEnumMap, json['technicalMistakes']),
    memoryFlubs: _$enumDecode(_$PracticeMistakesEnumMap, json['memoryFlubs']),
  );
}

Map<String, dynamic> _$_$_PracticeEntityToJson(_$_PracticeEntity instance) =>
    <String, dynamic>{
      'id': instance.id,
      'pieceId': instance.pieceId,
      'date': instance.date.toIso8601String(),
      'technicalMistakes':
          _$PracticeMistakesEnumMap[instance.technicalMistakes],
      'memoryFlubs': _$PracticeMistakesEnumMap[instance.memoryFlubs],
    };

K _$enumDecode<K, V>(
  Map<K, V> enumValues,
  Object? source, {
  K? unknownValue,
}) {
  if (source == null) {
    throw ArgumentError(
      'A value must be provided. Supported values: '
      '${enumValues.values.join(', ')}',
    );
  }

  return enumValues.entries.singleWhere(
    (e) => e.value == source,
    orElse: () {
      if (unknownValue == null) {
        throw ArgumentError(
          '`$source` is not one of the supported values: '
          '${enumValues.values.join(', ')}',
        );
      }
      return MapEntry(unknownValue, enumValues.values.first);
    },
  ).key;
}

const _$PracticeMistakesEnumMap = {
  PracticeMistakes.none: 'none',
  PracticeMistakes.few: 'few',
  PracticeMistakes.some: 'some',
  PracticeMistakes.many: 'many',
  PracticeMistakes.everywhere: 'everywhere',
};
