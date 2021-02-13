import 'failure.dart';

class ServerFailure extends Failure {
  final ServerFailureTypes type;

  ServerFailure({this.type = ServerFailureTypes.unknown});

  List<Object> get props => [...super.props, type];
}

enum ServerFailureTypes {
  idNotNullWhenAddNew,
  unknown,
}
