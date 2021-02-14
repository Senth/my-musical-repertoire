import 'dart:io';

import 'package:hive/hive.dart';
import 'package:path/path.dart' as path;
import 'package:uuid/uuid.dart';

class HiveGateway {
  static final Uuid _uuid = Uuid();
  static Future<Box> _piecesBox;
  static bool _testing;

  static init({bool testing = false}) {
    String directory;
    _testing = testing;

    if (testing) {
      directory = Directory.systemTemp.path;
      directory = path.join(directory, 'MMR-tests');
      new Directory(directory).create();
    } else {
      directory = Directory.current.path;
    }

    Hive.init(directory);

    _piecesBox = Hive.openBox('pieces');
  }

  static String generateId() => _uuid.v4();

  static Future<Box> get piecesBox => _piecesBox;

  static close() async {
    // Remove test databases
    if (_testing) {
      await Hive.deleteFromDisk();
    }

    await Hive.close();
    _piecesBox = null;
  }
}
