import 'package:flutter/foundation.dart';
import '../../domain/entities/piece.dart';

class PieceModel extends Piece {
  PieceModel({
    @required String id,
    @required String name,
    DateTime lastPracticed,
  }) : super(id: id, name: name, lastPracticed: lastPracticed);

  factory PieceModel.fromJson(Map<String, dynamic> json) {
    DateTime lastPracticed;
    if (json.containsKey('lastPracticed')) {
      lastPracticed = DateTime.fromMillisecondsSinceEpoch(json['lastPracticed'] * 1000);
    }

    return PieceModel(id: json['id'], name: json['name'], lastPracticed: lastPracticed);
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> map = {
      "id": id,
      "name": name,
    };

    if (lastPracticed != null) {
      map["lastPracticed"] = lastPracticed.millisecondsSinceEpoch / 1000;
    }

    return map;
  }
}
