import 'package:freezed_annotation/freezed_annotation.dart';

enum ReviewStatus {
  @JsonValue('Q')
  queued('Q'),
  @JsonValue('new')
  newValue('new');

  const ReviewStatus(this.value);

  /// The value stored in Firestore.
  final String value;
}
