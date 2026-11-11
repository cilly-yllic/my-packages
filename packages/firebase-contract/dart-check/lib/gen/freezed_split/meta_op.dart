// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';

part 'meta_op.freezed.dart';
part 'meta_op.g.dart';

@freezed
abstract class MetaOp with _$MetaOp {
  @JsonSerializable(explicitToJson: true)
  const factory MetaOp({
    /// op id
    required String id,
  }) = _MetaOp;

  factory MetaOp.fromJson(Map<String, dynamic> json) => _$MetaOpFromJson(json);
}
