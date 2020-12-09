import 'dart:io';
import 'package:path/path.dart' as path;

String fixture(String name) => File(path.join('test', 'fixtures', name)).readAsStringSync();
