import 'package:bloc/bloc.dart';
import 'package:firebase_auth/firebase_auth.dart';

class EmailSignInCubit extends Cubit<EmailSignInState> {
  EmailSignInCubit() : super(EmailSignInState());

  Future<void> signIn(String email, String password) async {
    emit(EmailSignInState(loading: true));
    try {
      UserCredential userCredential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email,
        password: password
      );
      emit(EmailSignInState(success: true));
    } on FirebaseAuthException catch (e) {
      if (e.code == 'user-not-found' || e.code == 'wrong-password') {
        emit(EmailSignInState(error: EmailSignInErrors.userNotFound));
      } else if (e.code == 'user-disabled') {
        emit(EmailSignInState(error: EmailSignInErrors.userDisabled));
      } else {
        emit(EmailSignInState(error: EmailSignInErrors.server));
      }
    }
  }
}

enum EmailSignInErrors {
  invalidEmail("screen.login.error.invalidEmail"),
  userNotFound( "screen.login.error.userNotFound"),
  userDisabled( "screen.login.error.userDisabled"),
  server("screen.login.error.server");

  const EmailSignInErrors(this.translationKey);
  final String translationKey;
}

class EmailSignInState {
  final EmailSignInErrors? error;
  final bool loading;
  final bool success;

  EmailSignInState({
    this.error,
    this.loading = false,
    this.success = false,
  });
}