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
