import 'package:cloud_firestore/cloud_firestore.dart';

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

/// Lifecycle state of a product
enum ProductStatus {
  draft('DRAFT'),
  /// Waiting for &lt;review&gt;
  inReview('IN_REVIEW'),
  published('PUBLISHED');

  const ProductStatus(this.value);

  /// The value stored in Firestore.
  final String value;

  static ProductStatus fromJson(String value) => values.firstWhere(
        (entry) => entry.value == value,
        orElse: () => throw ArgumentError.value(value, 'value', 'Unknown ProductStatus'),
      );

  String toJson() => value;
}

enum ReviewStatus {
  queued('Q'),
  newValue('new');

  const ReviewStatus(this.value);

  /// The value stored in Firestore.
  final String value;

  static ReviewStatus fromJson(String value) => values.firstWhere(
        (entry) => entry.value == value,
        orElse: () => throw ArgumentError.value(value, 'value', 'Unknown ReviewStatus'),
      );

  String toJson() => value;
}

class MetaOp {
  const MetaOp({
    required this.id,
  });

  factory MetaOp.fromJson(Map<String, dynamic> json) => MetaOp(
        id: json['id'] as String,
      );

  /// op id
  final String id;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
      };
}

/// consistency envelope
class Meta {
  const Meta({
    this.scope,
    this.op,
    this.syncedAt,
  });

  factory Meta.fromJson(Map<String, dynamic> json) => Meta(
        scope: (json['scope'] as num?)?.toDouble(),
        op: json['op'] == null ? null : MetaOp.fromJson(json['op'] as Map<String, dynamic>),
        syncedAt: timestampFromJsonOrNull(json['syncedAt']),
      );

  final double? scope;

  final MetaOp? op;

  final DateTime? syncedAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'scope': scope,
        'op': op?.toJson(),
        if (syncedAt != null) 'syncedAt': timestampToJsonOrNull(syncedAt),
      };
}

class Dimensions {
  const Dimensions({
    required this.width,
    required this.height,
    this.unit = 'cm',
  });

  factory Dimensions.fromJson(Map<String, dynamic> json) => Dimensions(
        width: (json['width'] as num).toDouble(),
        height: (json['height'] as num).toDouble(),
        unit: json['unit'] as String? ?? 'cm',
      );

  final double width;

  final double height;

  final String unit;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'width': width,
        'height': height,
        'unit': unit,
      };
}

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

/// A shop document
///
/// Firestore: `shops/{shopId}`
class Shop {
  const Shop({
    required this.id,
    required this.name,
    required this.ownerId,
    required this.status,
    required this.createdAt,
    this.updatedAt,
    required this.meta,
  });

  factory Shop.fromJson(Map<String, dynamic> json) => Shop(
        id: json['id'] as String,
        name: json['name'] as String,
        ownerId: json['ownerId'] as String,
        status: ProductStatus.fromJson(json['status'] as String),
        createdAt: timestampFromJson(json['createdAt']),
        updatedAt: timestampFromJsonOrNull(json['updatedAt']),
        meta: Meta.fromJson(json['_meta_'] as Map<String, dynamic>),
      );

  final String id;

  final String name;

  final String ownerId;

  final ProductStatus status;

  final DateTime createdAt;

  final DateTime? updatedAt;

  final Meta meta;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'name': name,
        'ownerId': ownerId,
        'status': status.toJson(),
        'createdAt': timestampToJson(createdAt),
        'updatedAt': timestampToJsonOrNull(updatedAt),
        '_meta_': meta.toJson(),
      };
}

/// Firestore path helpers for [Shop].
abstract final class ShopPath {
  static const String template = 'shops/{shopId}';

  static String collection() => 'shops';

  static String doc({required String shopId}) => 'shops/$shopId';
}

/// Firestore: `shops/{shopId}/products/{product-id}`
class Product {
  const Product({
    required this.shopId,
    required this.title,
    required this.price,
    this.dimensions,
    this.tags = const <String>[],
    this.review = ReviewStatus.queued,
    required this.publishedAts,
    this.attributes,
    this.note,
    this.archived,
    this.defaultValue,
    this.fallback = 'none',
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        shopId: json['shopId'] as String,
        title: json['title'] as String,
        price: (json['price'] as num).toInt(),
        dimensions: json['dimensions'] == null ? null : Dimensions.fromJson(json['dimensions'] as Map<String, dynamic>),
        tags: (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ?? <String>[],
        review: (json['review'] == null ? null : ReviewStatus.fromJson(json['review'] as String)) ?? ReviewStatus.queued,
        publishedAts: (json['publishedAts'] as List<dynamic>).map((e) => timestampFromJson(e)).toList(),
        attributes: json['attributes'],
        note: json['note'] as String?,
        archived: json['archived'] as bool?,
        defaultValue: json['default'] as String?,
        fallback: json.containsKey('fallback') ? json['fallback'] as String? : 'none',
      );

  final String shopId;

  final String title;

  final int price;

  final Dimensions? dimensions;

  final List<String> tags;

  final ReviewStatus review;

  final List<DateTime> publishedAts;

  final Object? attributes;

  /// absent when unset
  final String? note;

  final bool? archived;

  final String? defaultValue;

  final String? fallback;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'shopId': shopId,
        'title': title,
        'price': price,
        'dimensions': dimensions?.toJson(),
        'tags': tags,
        'review': review.toJson(),
        'publishedAts': publishedAts.map((e) => timestampToJson(e)).toList(),
        if (attributes != null) 'attributes': attributes,
        if (note != null) 'note': note,
        'archived': archived,
        if (defaultValue != null) 'default': defaultValue,
        'fallback': fallback,
      };
}

/// Firestore path helpers for [Product].
abstract final class ProductPath {
  static const String template = 'shops/{shopId}/products/{product-id}';

  static String collection({required String shopId}) => 'shops/$shopId/products';

  static String doc({required String shopId, required String productId}) => 'shops/$shopId/products/$productId';
}

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
