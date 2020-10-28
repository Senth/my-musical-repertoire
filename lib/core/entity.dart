import 'package:equatable/equatable.dart';

abstract class Entity extends Equatable {
  final String id;

  Entity(this.id);

  /// Overide this method in extended class
  @override
  List<Object> get props => throw UnimplementedError();
}
