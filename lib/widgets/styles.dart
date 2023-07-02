
import 'package:flutter/material.dart';


class Styles {
  static const unit = 8.0;
  static const unit2 = unit * 2;
  static const unit3 = unit * 3;
  static const unit4 = unit * 4;
  static const paddingBetween = SizedBox(height: unit2, width: unit2);

  static const fullWidth = 300.0;

  static InputDecoration fullWidthDecoration(String text) {
    return InputDecoration(
      labelText: text,
      border: const OutlineInputBorder(),
      constraints: const BoxConstraints(minWidth: fullWidth, maxWidth: fullWidth),
    );
  }
}