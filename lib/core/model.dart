import 'package:equatable/equatable.dart';

abstract class Model extends Equatable {
  final String id;

  Model(this.id);

  @override
  List<Object> get props => [this.id];

  @override
  bool get stringify => true;
}
