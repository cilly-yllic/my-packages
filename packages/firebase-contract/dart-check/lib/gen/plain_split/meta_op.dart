class MetaOp {
  const MetaOp({
    required this.id,
  });

  factory MetaOp.fromJson(Map<String, dynamic> json) => MetaOp(
        id: json['id'] as String,
      );

  /// op id
  final String id;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
      };
}
