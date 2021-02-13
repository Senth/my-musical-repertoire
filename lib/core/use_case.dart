import 'package:dartz/dartz.dart';

import 'failures/failure.dart';

abstract class UseCase<ReturnType, Params> {
  Future<Either<Failure, ReturnType>> call(Params params);
}

abstract class NoParams {}
