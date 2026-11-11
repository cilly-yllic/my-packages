/// Minimal stand-in for `package:cloud_firestore` exposing only the
/// `Timestamp` API the generated code uses, so `dart analyze` runs without
/// the Flutter SDK.
library;

class Timestamp {
  Timestamp(this.seconds, this.nanoseconds);

  factory Timestamp.fromDate(DateTime date) {
    final micros = date.microsecondsSinceEpoch;
    return Timestamp(micros ~/ 1000000, (micros % 1000000) * 1000);
  }

  final int seconds;
  final int nanoseconds;

  DateTime toDate() => DateTime.fromMicrosecondsSinceEpoch(seconds * 1000000 + nanoseconds ~/ 1000);
}
