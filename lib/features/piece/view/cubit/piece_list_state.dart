part of 'piece_list_cubit.dart';

abstract class PieceListState extends Equatable {
  const PieceListState();

  @override
  List<Object> get props => [];
}

class PieceListInitial extends PieceListState {}

class PieceListLoading extends PieceListState {}

class PieceListLoaded extends PieceListState {}

class PieceListError extends PieceListState {}
