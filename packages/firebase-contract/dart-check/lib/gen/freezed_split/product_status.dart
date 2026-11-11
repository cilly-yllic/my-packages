import 'package:freezed_annotation/freezed_annotation.dart';

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
