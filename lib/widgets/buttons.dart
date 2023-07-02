import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:my_musical_repertoire/app_localizations.dart';
import 'package:my_musical_repertoire/widgets/styles.dart';


class FullWidthButton extends StatelessWidget {
  final dynamic image;
  final String imageSemantics;
  final String buttonTextId;
  final VoidCallback onPressed;

  const FullWidthButton({
    super.key,
    required this.image,
    required this.imageSemantics,
    required this.buttonTextId,
    required this.onPressed,
}) : super();

  @override
  Widget build(BuildContext context) {
    Widget icon;

    switch (image.runtimeType) {
      case String:
        icon = SvgPicture.asset(image, width: 24, height: 24, semanticsLabel: imageSemantics);
        break;
      case IconData:
        icon = Icon(image, size: 24);
        break;
      default:
        icon = const Icon(Icons.error, size: 24);
    }

    return ElevatedButton.icon(
      icon: icon,
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(Styles.fullWidth, 0),
        padding: const EdgeInsets.all(16),
        alignment: Alignment.center,
        textStyle: const TextStyle(fontWeight: FontWeight.bold),
      ),
      label: Text(translate(context, buttonTextId)),
      onPressed: onPressed,
    );
  }
}