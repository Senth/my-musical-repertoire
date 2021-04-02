import 'package:equatable/equatable.dart';

abstract class Failure extends Equatable {
  @override
  bool get stringify => true;

  @override
  List<Object?> get props => [];
}
