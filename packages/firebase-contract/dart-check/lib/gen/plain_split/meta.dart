import 'meta_op.dart';
import 'timestamp_converter.dart';

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
