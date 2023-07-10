import 'package:flutter/material.dart';
import 'package:my_musical_repertoire/app_localizations.dart';

class PieceListPage extends StatelessWidget {
  const PieceListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(translate(context, "screen.pieceList.title")),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
      ),
      body: const Center(
        child:  Text('Your list goes here'),
      ),
    );
  }
}
