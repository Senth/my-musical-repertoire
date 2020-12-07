import 'package:dartz/dartz.dart';

import 'errors/error.dart';

abstract class UseCase<ReturnType, Params> {
  Future<Either<Error, ReturnType>> call(Params params);
}

abstract class NoParams {}
