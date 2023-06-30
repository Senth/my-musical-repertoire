import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:my_musical_repertoire/app_localizations.dart';
import 'package:provider/provider.dart';
import 'package:my_musical_repertoire/services/authentication_service.dart';
import 'package:my_musical_repertoire/screens/piece_list_page.dart';

class LoginButton extends StatelessWidget {
  final String imagePath;
  final String imageSemantics;
  final String buttonTextId;
  final VoidCallback onPressed;

  const LoginButton({
    super.key,
    required this.imagePath,
    required this.imageSemantics,
    required this.buttonTextId,
    required this.onPressed,
}) : super();

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      icon: SvgPicture.asset(imagePath, width: 24, height: 24, semanticsLabel: imageSemantics),
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(300, 36),
        padding: const EdgeInsets.all(16),
        alignment: Alignment.center,
      ),
      label: Text(translate(context, buttonTextId)),
      onPressed: onPressed,
    );
  }
}