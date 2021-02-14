// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'piece_entity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PieceEntity _$PieceEntityFromJson(Map<String, dynamic> json) {
  return PieceEntity(
    id: json['id'] as String,
    title: json['title'] as String,
    composer: json['composer'] as String,
    lastPracticed: json['lastPracticed'] == null
        ? null
        : DateTime.parse(json['lastPracticed'] as String),
  );
}

Map<String, dynamic> _$PieceEntityToJson(PieceEntity instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'composer': instance.composer,
      'lastPracticed': instance.lastPracticed?.toIso8601String(),
    };
