import 'package:flutter/material.dart';
import 'package:my_musical_repertoire/app_localizations.dart';

class PieceListPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(translate(context, "screen.pieceList.title")),
      ),
      body: Center(
        child: Text('Your list goes here'),
      ),
    );
  }
}
