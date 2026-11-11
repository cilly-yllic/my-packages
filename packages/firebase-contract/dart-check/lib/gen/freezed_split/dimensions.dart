// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dimensions.freezed.dart';
part 'dimensions.g.dart';

@freezed
abstract class Dimensions with _$Dimensions {
  @JsonSerializable(explicitToJson: true)
  const factory Dimensions({
    required double width,
    required double height,
    @Default('cm') String unit,
  }) = _Dimensions;

  factory Dimensions.fromJson(Map<String, dynamic> json) => _$DimensionsFromJson(json);
}
