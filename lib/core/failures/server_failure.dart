import 'package:freezed_annotation/freezed_annotation.dart';

import 'failure.dart';

part 'server_failure.freezed.dart';

@freezed
class ServerFailure with _$ServerFailure implements Failure {
  const factory ServerFailure({@Default(ServerFailureTypes.unknown) ServerFailureTypes type}) = _ServerFailure;
}

enum ServerFailureTypes {
  idNotNullWhenAddNew,
  unknown,
}
