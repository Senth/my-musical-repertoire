import 'package:equatable/equatable.dart';

abstract class Error extends Equatable {
  @override
  bool get stringify => true;
}
