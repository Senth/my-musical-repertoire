import 'package:meta/meta.dart';

import '../../domain/entities/piece_entity.dart';

class PieceModel extends PieceEntity {
  PieceModel({
    @required String id,
    @required String name,
    DateTime lastPracticed,
  }) : super(
          id: id,
          name: name,
          lastPracticed: lastPracticed,
        );

  factory PieceModel.fromEntity(PieceEntity entity) {
    return PieceModel(
      id: entity.id,
      name: entity.name,
      lastPracticed: entity.lastPracticed,
    );
  }

  factory PieceModel.fromJson(Map<String, dynamic> json) {
    return PieceModel(
      id: json["id"],
      name: json["name"],
      lastPracticed: json["lastPracticed"],
    );
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> map = {
      "id": id,
      "name": name,
      "lastPracticed": lastPracticed,
    };
    return map;
  }
}
