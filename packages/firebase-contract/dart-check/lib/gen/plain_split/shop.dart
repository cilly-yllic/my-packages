import 'meta.dart';
import 'product_status.dart';
import 'timestamp_converter.dart';

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
