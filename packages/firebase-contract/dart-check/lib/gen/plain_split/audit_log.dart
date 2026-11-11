import 'timestamp_converter.dart';

/// Firestore: `audit_logs`
class AuditLog {
  const AuditLog({
    required this.message,
    required this.at,
  });

  factory AuditLog.fromJson(Map<String, dynamic> json) => AuditLog(
        message: json['message'] as String,
        at: timestampFromJson(json['at']),
      );

  final String message;

  final DateTime at;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'message': message,
        'at': timestampToJson(at),
      };
}

/// Firestore path helpers for [AuditLog].
abstract final class AuditLogPath {
  static const String template = 'audit_logs';

  static String collection() => 'audit_logs';
}
