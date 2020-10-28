import 'package:flutter/material.dart';
import 'package:my_musical_repertoire/AppLocalizations.dart';

class Pieces extends StatefulWidget {
  Pieces();

  _PiecesState createState() => _PiecesState();
}

class _PiecesState extends State<Pieces> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(translate(context, 'piecesTitle'))),
      body: Row(),
      floatingActionButton: FloatingActionButton(
          onPressed: () => print('Pressed'),
          tooltip: translate(context, 'addPieceTooltip'),
          child: Icon(Icons.add)),
    );
  }
}
