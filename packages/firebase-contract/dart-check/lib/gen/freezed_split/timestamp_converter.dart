import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:json_annotation/json_annotation.dart';

/// Reads a Firestore timestamp: a `Timestamp`, `DateTime`, ISO-8601 string,
/// epoch milliseconds, or a `{_seconds, _nanoseconds}` map (Admin SDK JSON).
DateTime timestampFromJson(Object? value) {
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is String) return DateTime.parse(value);
  if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
  if (value is Map) {
    final seconds = value['_seconds'] ?? value['seconds'];
    final nanoseconds = value['_nanoseconds'] ?? value['nanoseconds'] ?? 0;
    if (seconds is int && nanoseconds is int) {
      return Timestamp(seconds, nanoseconds).toDate();
    }
  }
  throw ArgumentError.value(value, 'value', 'Unsupported timestamp value');
}

/// Nullable variant of [timestampFromJson].
DateTime? timestampFromJsonOrNull(Object? value) => value == null ? null : timestampFromJson(value);

/// Writes a `DateTime` as a Firestore `Timestamp`.
Timestamp timestampToJson(DateTime value) => Timestamp.fromDate(value);

/// Nullable variant of [timestampToJson].
Timestamp? timestampToJsonOrNull(DateTime? value) => value == null ? null : timestampToJson(value);

/// json_serializable converter between `DateTime` and Firestore `Timestamp`.
class TimestampConverter implements JsonConverter<DateTime, Object> {
  const TimestampConverter();

  @override
  DateTime fromJson(Object json) => timestampFromJson(json);

  @override
  Object toJson(DateTime object) => timestampToJson(object);
}
