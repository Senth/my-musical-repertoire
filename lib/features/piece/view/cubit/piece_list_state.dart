part of 'piece_list_cubit.dart';

abstract class PieceListState {
  const PieceListState();
}

class PieceListInitial extends PieceListState {}

class PieceListLoading extends PieceListState {}

class PieceListLoaded extends PieceListState {}

class PieceListError extends PieceListState {}
