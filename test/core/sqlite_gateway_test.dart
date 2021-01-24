@Skip("sqflite cannot run on the machine.")

import 'package:flutter_test/flutter_test.dart';
import 'package:my_musical_repertoire/core/sqlite_gateway.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'dart:io' as io;

class SqliteTest extends SqliteGateway {
  static Future<Database> get db => SqliteGateway.db;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group("SqliteGateway (#db #hot #file) ->", () {
    String dbFilePath;

    setUpAll(() async {
      dbFilePath = join(await getDatabasesPath(), "my_musical_repertoire_test.db");
    });

    group("initDb() ", () {
      tearDown(() async {
        final database = await SqliteTest.db;
        await database.close();
        await deleteDatabase(dbFilePath);
      });

      test("should create a new DB in dbFilePath when called", () async {
        await SqliteGateway.initDb(testing: true);

        final exists = await io.File(dbFilePath).exists();

        expect(exists, true);
      });

      test("should call onCreate() and create a DB when initialized", () async {
        await SqliteGateway.initDb();

        onCreateTest(SqliteTest.db);
      });
    });

    test("onCreate() should initialize a DB with tables when running", () async {
      // final db = await openDatabase(dbFilePath);
    });
  });
}

onCreateTest(Future<Database> futureDb) async {
  final db = await futureDb;

  final testData = [
    "SELECT name FROM sqlite_master WHERE type='table' AND name='piece'",
    "SELECT name FROM sqlite_master WHERE type='table' AND name='practice'",
  ];

  for (final test in testData) {
    final rows = await db.rawQuery(test);
    expect(rows.length, 1);
  }
}
