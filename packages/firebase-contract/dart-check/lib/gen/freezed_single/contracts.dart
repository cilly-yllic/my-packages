// ignore_for_file: invalid_annotation_target

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'contracts.freezed.dart';
part 'contracts.g.dart';

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

/// Lifecycle state of a product
enum ProductStatus {
  @JsonValue('DRAFT')
  draft('DRAFT'),
  /// Waiting for &lt;review&gt;
  @JsonValue('IN_REVIEW')
  inReview('IN_REVIEW'),
  @JsonValue('PUBLISHED')
  published('PUBLISHED');

  const ProductStatus(this.value);

  /// The value stored in Firestore.
  final String value;
}

enum ReviewStatus {
  @JsonValue('Q')
  queued('Q'),
  @JsonValue('new')
  newValue('new');

  const ReviewStatus(this.value);

  /// The value stored in Firestore.
  final String value;
}

@freezed
abstract class MetaOp with _$MetaOp {
  @JsonSerializable(explicitToJson: true)
  const factory MetaOp({
    /// op id
    required String id,
  }) = _MetaOp;

  factory MetaOp.fromJson(Map<String, dynamic> json) => _$MetaOpFromJson(json);
}

/// consistency envelope
@freezed
abstract class Meta with _$Meta {
  @JsonSerializable(explicitToJson: true)
  const factory Meta({
    double? scope,
    MetaOp? op,
    @JsonKey(includeIfNull: false) @TimestampConverter() DateTime? syncedAt,
  }) = _Meta;

  factory Meta.fromJson(Map<String, dynamic> json) => _$MetaFromJson(json);
}

@freezed
abstract class Dimensions with _$Dimensions {
  @JsonSerializable(explicitToJson: true)
  const factory Dimensions({
    required double width,
    required double height,
    @Default('cm') String unit,
  }) = _Dimensions;

  factory Dimensions.fromJson(Map<String, dynamic> json) => _$DimensionsFromJson(json);
}

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

/// A shop document
///
/// Firestore: `shops/{shopId}`
@freezed
abstract class Shop with _$Shop {
  @JsonSerializable(explicitToJson: true)
  const factory Shop({
    required String id,
    required String name,
    required String ownerId,
    required ProductStatus status,
    @TimestampConverter() required DateTime createdAt,
    @TimestampConverter() DateTime? updatedAt,
    @JsonKey(name: '_meta_') required Meta meta,
  }) = _Shop;

  factory Shop.fromJson(Map<String, dynamic> json) => _$ShopFromJson(json);
}

/// Firestore path helpers for [Shop].
abstract final class ShopPath {
  static const String template = 'shops/{shopId}';

  static String collection() => 'shops';

  static String doc({required String shopId}) => 'shops/$shopId';
}

/// Firestore: `shops/{shopId}/products/{product-id}`
@freezed
abstract class Product with _$Product {
  @JsonSerializable(explicitToJson: true)
  const factory Product({
    required String shopId,
    required String title,
    required int price,
    Dimensions? dimensions,
    @Default(<String>[]) List<String> tags,
    @Default(ReviewStatus.queued) ReviewStatus review,
    @TimestampConverter() required List<DateTime> publishedAts,
    @JsonKey(includeIfNull: false) Object? attributes,
    /// absent when unset
    @JsonKey(includeIfNull: false) String? note,
    bool? archived,
    @JsonKey(name: 'default', includeIfNull: false) String? defaultValue,
    @JsonKey(readValue: _read$Product$fallback) String? fallback,
  }) = _Product;

  factory Product.fromJson(Map<String, dynamic> json) => _$ProductFromJson(json);
}

Object? _read$Product$fallback(Map<dynamic, dynamic> json, String key) =>
    json.containsKey(key) ? json[key] : 'none';

/// Firestore path helpers for [Product].
abstract final class ProductPath {
  static const String template = 'shops/{shopId}/products/{product-id}';

  static String collection({required String shopId}) => 'shops/$shopId/products';

  static String doc({required String shopId, required String productId}) => 'shops/$shopId/products/$productId';
}

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
