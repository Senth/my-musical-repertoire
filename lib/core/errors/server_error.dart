import 'error.dart';

class ServerError extends Error {
  final ServerErrorTypes type;

  ServerError({this.type = ServerErrorTypes.unknown});

  List<Object> get props => [...super.props, type];
}

enum ServerErrorTypes {
  idNotNullWhenAddNew,
  unknown,
}
