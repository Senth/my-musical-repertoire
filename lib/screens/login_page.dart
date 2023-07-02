import 'package:flutter/material.dart';
import 'package:my_musical_repertoire/app_localizations.dart';
import 'package:my_musical_repertoire/services/authentication_service.dart';
import 'package:my_musical_repertoire/widgets/buttons.dart';
import 'package:my_musical_repertoire/widgets/styles.dart';
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
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            EmailSignIn(key: UniqueKey()),
            Styles.paddingBetween,
            Text(translate(context, "screen.login.or")),
            Styles.paddingBetween,
            FullWidthButton(
                image: 'images/google.svg',
                imageSemantics: 'Google',
                buttonTextId: 'screen.login.google',
                onPressed: () {
                  context
                      .read<AuthenticationService>()
                      .signInWithGoogle()
                      .then((value) {
                    if (value != null) {
                      Navigator.of(context).pushReplacementNamed('/pieceList');
                    }
                  });
                }),
          ],
        ),
      ),
    );
  }
}

class EmailSignIn extends StatelessWidget {
  const EmailSignIn({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextFormField(
          decoration: Styles.fullWidthDecoration(translate(context, "screen.login.email.title")),
        ),
        Styles.paddingBetween,
        TextFormField(
          decoration: Styles.fullWidthDecoration(translate(context, "screen.login.password.title")),
        ),
        Styles.paddingBetween,
        FullWidthButton(
          image: Icons.email,
          imageSemantics: 'Email',
          buttonTextId: 'screen.login.email',
          onPressed: () {
            // TODO do sign in
          },
        ),
      ],
    );
  }
}