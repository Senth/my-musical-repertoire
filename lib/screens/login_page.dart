import 'package:flutter/material.dart';
import 'package:my_musical_repertoire/app_localitazations.dart';
import 'package:my_musical_repertoire/services/authentication_service.dart';
import 'package:my_musical_repertoire/widgets/login_button.dart';
import 'package:provider/provider.dart';


class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(translate(context, "screen.login.title")),
      ),
      body: Center(
        child:  LoginButton(
          imagePath: 'images/google.svg',
          imageSemantics: 'Google',
          buttonTextId: 'screen.login.google',
          onPressed: () {
            context.read<AuthenticationService>().signInWithGoogle().then((value) {
              if (value != null) {
                Navigator.of(context).pushReplacementNamed('/pieceList');
              }
            });
          }
        ),
      ),
    );
  }
}
