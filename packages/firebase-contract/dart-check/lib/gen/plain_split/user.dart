import 'timestamp_converter.dart';

/// Firestore: `users/{userId}`
class User {
  const User({
    required this.displayName,
    this.photoURL,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        displayName: json['displayName'] as String,
        photoURL: json['photoURL'] as String?,
        createdAt: timestampFromJson(json['createdAt']),
      );

  final String displayName;

  final String? photoURL;

  final DateTime createdAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'displayName': displayName,
        'photoURL': photoURL,
        'createdAt': timestampToJson(createdAt),
      };
}

/// Firestore path helpers for [User].
abstract final class UserPath {
  static const String template = 'users/{userId}';

  static String collection() => 'users';

  static String doc({required String userId}) => 'users/$userId';
}
