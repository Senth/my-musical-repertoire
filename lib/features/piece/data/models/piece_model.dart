import 'package:meta/meta.dart';
import '../../../../core/model.dart';
import '../../domain/entities/piece_entity.dart';

class PieceModel extends Model {
  final String title;
  final String composer;
  final DateTime lastPracticed;

  @override
  List<Object> get props => [
        ...super.props,
        this.title,
        this.composer,
        this.lastPracticed,
      ];

  PieceModel({
    String id,
    @required this.title,
    @required this.composer,
    this.lastPracticed,
  }) : super(id);

  factory PieceModel.fromEntity(PieceEntity entity) {
    return PieceModel(
      id: entity.id,
      title: entity.title,
      composer: entity.composer,
      lastPracticed: entity.lastPracticed,
    );
  }

  factory PieceModel.fromMap(Map<String, dynamic> json) {
    return PieceModel(
      id: json["id"],
      title: json["title"],
      composer: json["composer"],
      lastPracticed: json["lastPracticed"],
    );
  }

  Map<String, dynamic> toMap() {
    final Map<String, dynamic> map = {
      "id": id,
      "title": title,
      "composer": composer,
      "lastPracticed": lastPracticed,
    };
    return map;
  }

  PieceEntity toEntity() {
    return PieceEntity(
      id: this.id,
      title: this.title,
      composer: this.composer,
      lastPracticed: this.lastPracticed,
    );
  }
}
