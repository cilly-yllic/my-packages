// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dimensions.dart';
import 'review_status.dart';
import 'timestamp_converter.dart';

part 'product.freezed.dart';
part 'product.g.dart';

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
  }) = _Product;

  factory Product.fromJson(Map<String, dynamic> json) => _$ProductFromJson(json);
}

/// Firestore path helpers for [Product].
abstract final class ProductPath {
  static const String template = 'shops/{shopId}/products/{product-id}';

  static String collection({required String shopId}) => 'shops/$shopId/products';

  static String doc({required String shopId, required String productId}) => 'shops/$shopId/products/$productId';
}
