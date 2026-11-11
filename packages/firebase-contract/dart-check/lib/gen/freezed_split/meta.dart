// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';

import 'meta_op.dart';
import 'timestamp_converter.dart';

part 'meta.freezed.dart';
part 'meta.g.dart';

/// consistency envelope
@freezed
abstract class Meta with _$Meta {
  @JsonSerializable(explicitToJson: true)
  const factory Meta({
    double? scope,
    MetaOp? op,
    @JsonKey(includeIfNull: false) @TimestampConverter() DateTime? syncedAt,
  }) = _Meta;

  factory Meta.fromJson(Map<String, dynamic> json) => _$MetaFromJson(json);
}
