import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:my_musical_repertoire/app_localizations.dart';
import 'package:my_musical_repertoire/blocs/login.dart';
import 'package:my_musical_repertoire/services/authentication_service.dart';
import 'package:my_musical_repertoire/widgets/buttons.dart';
import 'package:my_musical_repertoire/widgets/styles.dart';

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Theme.of(context).colorScheme.onPrimary,
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
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  EmailSignIn({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => EmailSignInCubit(),
      child: BlocConsumer<EmailSignInCubit, EmailSignInState>(
          listener: (context, state) {
            if (state.success) {
              Navigator.of(context).pushReplacementNamed('/pieceList');
            } else if (state.loading) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(translate(context, "screen.login.loading")),
                ),
              );
            } else if (state.error != null) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(translate(context, state.error!.translationKey)),
                ),
              );
            }
          },
          builder: (context, state) {
            return Column(
              children: [
                TextFormField(
                  controller: _emailController,
                  decoration: Styles.fullWidthDecoration(
                      translate(context, "screen.login.email.title")),
                ),
                Styles.paddingBetween,
                TextFormField(
                  controller: _passwordController,
                  decoration: Styles.fullWidthDecoration(
                      translate(context, "screen.login.password.title")),
                ),
                Styles.paddingBetween,
                FullWidthButton(
                  image: Icons.email,
                  imageSemantics: 'Email',
                  buttonTextId: 'screen.login.email',
                  onPressed: () {
                    context.read<EmailSignInCubit>().signIn(
                      _emailController.text.trim(),
                      _passwordController.text.trim(),
                    );
                  },
                ),
              ],
            );
          }
      ),
    );
  }
}