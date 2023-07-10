enum Routes {
  pieceList('/pieceList'),
  home('/'),
  login('/login');

  final String path;
  const Routes(this.path);
}