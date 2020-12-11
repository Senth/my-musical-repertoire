import 'package:meta/meta.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

abstract class SqliteGateway {
  @protected
  static Future<Database> db;

  static Future<void> initDb({bool testing = false}) async {
    String dbName = 'my_musical_repertoire';
    if (testing) {
      dbName += '_test';
    }
    dbName += '.db';
    db = openDatabase(
      join(await getDatabasesPath(), dbName),
      version: 1,
      onCreate: onCreate,
    );
  }

  static Future<void> onCreate(Database db, int version) {
    List<Future<void>> results = [];

    // Piece
    Future<void> result = db.execute(
      "CREATE TABLE piece(id BLOB PRIMARY KEY, name TEXT, lastPracticed TEXT)",
    );
    results.add(result);

    result = db.execute(
      "CREATE TABLE practice(id BLOB PRIMARY KEY, pieceId BLOB, date TEXT, technicalMistakes TEXT, memoryFlubs TEXT)",
    );
    results.add(result);

    return Future.wait(results);
  }
}
