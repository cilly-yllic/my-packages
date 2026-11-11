class Dimensions {
  const Dimensions({
    required this.width,
    required this.height,
    this.unit = 'cm',
  });

  factory Dimensions.fromJson(Map<String, dynamic> json) => Dimensions(
        width: (json['width'] as num).toDouble(),
        height: (json['height'] as num).toDouble(),
        unit: json['unit'] as String? ?? 'cm',
      );

  final double width;

  final double height;

  final String unit;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'width': width,
        'height': height,
        'unit': unit,
      };
}
