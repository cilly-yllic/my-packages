// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';

import 'timestamp_converter.dart';

part 'user.freezed.dart';
part 'user.g.dart';

/// Firestore: `users/{userId}`
@freezed
abstract class User with _$User {
  @JsonSerializable(explicitToJson: true)
  const factory User({
    required String displayName,
    String? photoURL,
    @TimestampConverter() required DateTime createdAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

/// Firestore path helpers for [User].
abstract final class UserPath {
  static const String template = 'users/{userId}';

  static String collection() => 'users';

  static String doc({required String userId}) => 'users/$userId';
}
