import 'dart:io';

import 'package:hive/hive.dart';
import 'package:path/path.dart' as path;

class HiveGateway {
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

  static close() async {
    // Remove test databases
    if (_testing) {
      await Hive.deleteFromDisk();
    }

    await Hive.close();
    _piecesBox = null;
  }
}
