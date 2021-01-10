import 'package:flutter/material.dart';

import '../AppLocalizations.dart';

class PieceList extends StatefulWidget {
  PieceList();

  _PieceListState createState() => _PieceListState();
}

class _PieceListState extends State<PieceList> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(translate(context, 'piecesTitle'))),
      body: Column(),
      floatingActionButton: FloatingActionButton(
          onPressed: () => print('Pressed'), tooltip: translate(context, 'addPieceTooltip'), child: Icon(Icons.add)),
    );
  }
}
