import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/hive_gateway.dart';

void main() {
  group("HiveGateway (#db) ->", () {
    setUp(() => HiveGateway.init(testing: true));

    tearDown(() => HiveGateway.close());
  });
}
