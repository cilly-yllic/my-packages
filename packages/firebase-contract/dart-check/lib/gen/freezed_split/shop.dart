// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';

import 'meta.dart';
import 'product_status.dart';
import 'timestamp_converter.dart';

part 'shop.freezed.dart';
part 'shop.g.dart';

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
