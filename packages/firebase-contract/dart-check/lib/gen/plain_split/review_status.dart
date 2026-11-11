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
