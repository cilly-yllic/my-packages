// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';

import 'timestamp_converter.dart';

part 'audit_log.freezed.dart';
part 'audit_log.g.dart';

/// Firestore: `audit_logs`
@freezed
abstract class AuditLog with _$AuditLog {
  @JsonSerializable(explicitToJson: true)
  const factory AuditLog({
    required String message,
    @TimestampConverter() required DateTime at,
  }) = _AuditLog;

  factory AuditLog.fromJson(Map<String, dynamic> json) => _$AuditLogFromJson(json);
}

/// Firestore path helpers for [AuditLog].
abstract final class AuditLogPath {
  static const String template = 'audit_logs';

  static String collection() => 'audit_logs';
}
