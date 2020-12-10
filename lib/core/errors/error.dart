import 'package:equatable/equatable.dart';

abstract class Error extends Equatable {
  @override
  bool get stringify => true;
}

class LocalServerError extends Error {
  @override
  List<Object> get props => [];
}

class RemoteServerError extends Error {
  @override
  List<Object> get props => [];
}
