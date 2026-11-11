// 生成した freezed / plain の両スタイルで fromJson → toJson が往復できることを確認する。
// `dart run bin/roundtrip.dart`（build_runner 実行後）。
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fbc_dart_check/gen/freezed_single/contracts.dart' as fz;
import 'package:fbc_dart_check/gen/plain_single/contracts.dart' as pl;

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

Map<String, dynamic> productJson() => <String, dynamic>{
      'shopId': 's1',
      'title': 'Mug',
      'price': 1200,
      'dimensions': <String, dynamic>{'width': 1.5, 'height': 2},
      'publishedAts': <Object>[Timestamp(1700000000, 0), '2024-01-02T03:04:05.000Z'],
      'archived': null,
      'default': 'x',
    };

void verify(Map<String, dynamic> out) {
  check(out['tags'] is List && (out['tags'] as List).isEmpty, 'tags default');
  check(out['review'] == 'Q', 'enum default is written as its stored value');
  check(out.containsKey('archived') && out['archived'] == null, 'nullable is written as null');
  check(!out.containsKey('note'), 'absent optional is omitted');
  check(out['default'] == 'x', 'renamed key keeps the Firestore name');
  check((out['publishedAts'] as List).every((e) => e is Timestamp), 'DateTime is written as Timestamp');
  check((out['dimensions'] as Map)['unit'] == 'cm', 'nested default + explicitToJson');
}

void main() {
  final freezed = fz.Product.fromJson(productJson());
  check(freezed.publishedAts[1].toUtc().year == 2024, 'ISO string decoded');
  verify(freezed.toJson());

  final plain = pl.Product.fromJson(productJson());
  check(plain.publishedAts[1].toUtc().year == 2024, 'ISO string decoded');
  verify(plain.toJson());

  check(fz.ShopPath.doc(shopId: 'a') == 'shops/a', 'path helper');
  check(pl.ProductPath.collection(shopId: 'a') == 'shops/a/products', 'path helper');
  print('roundtrip ok');
}
