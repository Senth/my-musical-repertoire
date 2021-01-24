import 'package:meta/meta.dart';
import 'package:sqflite/sqflite.dart';

abstract class SqliteGateway {
  @protected
  static Future<Database> db;

  SqliteGateway() {
    initDb();
  }

  static Future<void> initDb({bool testing = false}) async {
    String dbName = 'my_musical_repertoire';
    if (testing) {
      dbName += '_test';
    }
    dbName += '.db';
    db = openDatabase(
      dbName,
      version: 1,
      onConfigure: onConfigure,
      onCreate: onCreate,
      onUpgrade: onUpgrade,
      onDowngrade: onDowngrade,
      onOpen: onOpen,
    );
    return db.then((db) {});
  }

  static Future<void> onConfigure(Database db) {
    // TODO
    return Future(() => Null);
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

  static Future<void> onUpgrade(Database db, int fromVersion, int toVersion) {
    // TODO
    return Future(() => Null);
  }

  static Future<void> onDowngrade(Database db, int fromVersion, int toVersion) {
    // TODO
    return Future(() => Null);
  }

  static Future<void> onOpen(Database db) {
    // TODO
    return Future(() => Null);
  }
}
