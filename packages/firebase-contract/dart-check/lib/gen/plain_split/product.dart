import 'dimensions.dart';
import 'review_status.dart';
import 'timestamp_converter.dart';

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
      };
}

/// Firestore path helpers for [Product].
abstract final class ProductPath {
  static const String template = 'shops/{shopId}/products/{product-id}';

  static String collection({required String shopId}) => 'shops/$shopId/products';

  static String doc({required String shopId, required String productId}) => 'shops/$shopId/products/$productId';
}
