# firebase-contract

Treat a **YAML contract as the single source of truth** for a Firebase app and
generate every downstream representation from it — so shared types, enums, and
validation stop being hand-maintained in parallel (and stop drifting).

From one contract, generate:

- **TypeScript** types (interfaces + frozen-const enums)
- **Zod** validation schemas
- **Data Connect** GraphQL schema (`@table`, keys, directives), query/mutation
  operations (routed per connector), and `Any`↔logical adapters
- **Firestore** projection schemas (denormalized read model with `_meta_`)
- **API** request/response types, request-validation Zod, and class-validator DTOs
- **Cloud Task / Pub/Sub** payload envelopes + delivery constants
- **SQL migrations** for constraints Data Connect can't express (composite FKs,
  CHECK, indexes)
- **Per-entity id codecs** (typed encode/decode wrappers)
- **Discriminated unions**
- **Project config** (`dataconnect.yaml`, `connector.yaml`) + sync constants

## Install

```bash
npm i -D firebase-contract
```

Provides the `firebase-contract` (alias `fbc`) CLI and a programmatic API.

## Quick start

```bash
fbc init          # scaffold contract.yml + firebase-contract.json
fbc validate      # parse, resolve imports, semantically validate
fbc generate      # run every generator declared across the contract graph
fbc inspect       # print the normalized IR (debugging)
```

### One-command generation

Each contract file declares the generators it uses in a top-level
`generators:` block — a name plus an output template. Declaring a
**document-scoped** generator (typescript-split, zod-split, …) runs it once for
that yml; **api-scoped** generators (api-types, api-validation, api-dto,
task-payloads) run for the entries that opt in (see below):

```yaml
# contract.yml (root)
project:
  aliases:
    "#contracts/*": libs/contracts/src/*   # out templates may target aliases
generators:
  - { generator: typescript-split, out: "#contracts" }
  - { generator: api-types, out: "#contracts/api-types/{api-name}" }
imports:
  - ./apps/shop/data-connect/schema.yml
```

```yaml
# apps/shop/data-connect/schema.yml
generators:
  - { generator: data-connect-graphql-split, out: src }
  - { generator: sql-migrations, out: . }
```

- `out` resolves relative to the declaring yml; `#alias/...` prefixes resolve
  through the **root** yml's `project.aliases` (relative to the root).
- Api-scoped templates may use `{api-name}` (kebab-cased name) and `{path}`
  (REST path with `{param}` segments dropped).
- Entries reference declarations by name — nearest first (same yml → root).

`fbc generate contract.yml` materializes **all** declared outputs across the
whole import graph in one run. Passing `-o`/`-g` switches to single-target mode
(`fbc generate <entry> -o <dir> -g typescript,zod`), and
`firebase-contract.json` (`entry`, `outDir`, `generators`) can hold defaults.


### Generated-file headers

By default no banner is emitted. Opt in per run or per contract:

```bash
fbc generate --header                    # default AUTO-GENERATED banner
fbc generate --header "Managed by fbc"   # custom text (multi-line ok)
```

```yaml
header: default        # or any text; the CLI --header flag wins
```

Comment syntax adapts per file type (`//` for TS, `#` for GraphQL/YAML-ish,
`--` for SQL).

---

# The YAML DSL

A contract is composed of top-level sections — `enums`, `models`, `operations`,
`apis`, `firestore`, `unions`, `envelopes`, `project` — and `imports` that pull
in other contracts (relative paths or npm packages). Imports are resolved
transitively with cycle/duplicate detection and diamond dedup, so you can split
a large contract across files that mirror your repo layout.

```yaml
version: 1
imports:
  - ./apps/shop/data-connect/schema.yml
  - some-shared-package/contract.yml
```

## Enums

```yaml
enums:
  ProductStatus:
    description: Lifecycle state of a product
    values: [DRAFT, PUBLISHED, ARCHIVED]

  ShippingSpeed:
    description: |-
      Multi-line descriptions become multi-line comments.
    values:
      - { value: S, key: STANDARD }        # const-object key override → STANDARD: 'S'
      - { value: X, key: EXPRESS, description: per-value comment }
```

Enum options: `description`, `gqlName` (GraphQL rendering name),
`fsName` / `fsDescription` (Firestore-side rename/comment — e.g. render DC's
`Status` as `ReviewStatus` in projections), and per-value `key` /
`description` overrides.

By default the TypeScript generator emits the **frozen-const** representation
(runtime values + `Key` and value types) — the shape you'd otherwise hand-write
and keep in sync with the DC enum and the Zod enum:

```ts
export const PRODUCT_STATUS = Object.freeze({ DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' } as const)
export type ProductStatusKey = keyof typeof PRODUCT_STATUS
export type ProductStatus = (typeof PRODUCT_STATUS)[ProductStatusKey]
```

Pass `enumStyle: 'union'` to the TypeScript generator for a plain
`'OPEN' | 'DONE' | 'DISABLED'` union instead.

## Models

```yaml
models:
  User:
    fields:
      id: { type: id, id: true }
      name: string                 # shorthand — the value is the type
      email: { type: string, email: true }

  Product:
    description: A unit of work
    key: [catalog, productNo]            # composite primary key
    indexes:
      - { fields: [catalog, productNo], unique: true }
      - { fields: [status, createdAt] }
    fields:
      catalog: { type: Catalog, relation: true }
      productNo: int
      title: { type: string, nonempty: true, maxLength: 200 }
      status: ProductStatus
      metadata: { type: ProductMetadata, optional: true }   # embedded → Any
      createdAt: timestamp
```

### Scalar types

`string`, `int`, `float`, `boolean`, `timestamp`, `date`, `json`, `id`.

### Field options

| option                              | meaning                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `type`                              | document | scalar name, or an enum/model name                       |
| `optional`                          | document | value may be absent (`field?`)                           |
| `list`                              | document | value is an array of `type`                              |
| `id`                                | document | marks the (single) primary identifier                    |
| `unique`                            | document | field-level unique → `@unique`                           |
| `relation`                          | document | model-typed field is a foreign-key relation (see below)  |
| `col`                               | document | Data Connect column dataType (Int64 PKs default to `bigserial`) |
| `default`                           | document | `@default(expr: …)` on the DC column                     |
| `literal`                           | document | pin to one literal value (union discriminant tags)       |
| `nullable`                          | document | value may be `null` (`.nullable()` / `\| null`)          |
| `description`                       | document | doc comment carried into generated output                |
| `jsdoc`                             | document | render the description as a JSDoc block (Firestore fields) |
| **constraints** →                   |                                                          |
| `min` / `max`                       | document | numeric bounds                                           |
| `minLength` / `maxLength`           | document | string/array length bounds                               |
| `nonempty`                          | document | non-empty string/array                                   |
| `pattern`                           | document | regex the string must match                              |
| `email` / `url`                     | document | string format                                            |

Constraints flow into the Zod schemas, the API request validation, and the
class-validator DTOs.

### Model options

| option       | meaning                                                             |
| ------------ | ------------------------------------------------------------------ |
| `key`        | document | composite primary key field names (else the `id: true` field)      |
| `table`      | document | table name override (default: snake_case pluralization)            |
| `gqlName`    | document | GraphQL type name override                                          |
| `fsName`     | document | Firestore-side rename (avoid collisions with table models)          |
| `directives` | document | `multi` = each type-level directive on its own line                 |
| `footer`     | document | trailing comment block after the closing `}` in the schema file     |
| `indexes`    | document | composite `@index`/`@unique` (`{ fields, name?, unique?, expand? }` — `expand` renders args one per line) |
| `sql`        | document | raw SQL constraints (see [SQL migrations](#sql-migrations))         |

### Embedded vs relation

A field whose `type` is another model is one of two things:

- **embedded** (default) — a nested value object. Nested in TypeScript /
  Firestore / Zod; stored as `Any` (jsonb) in Data Connect with the logical type
  preserved and restored by the adapter.
- **relation** (`relation: true`) — a foreign-key reference to another table.
  Data Connect emits a relation (`owner: User!`, auto-creating the FK column);
  TypeScript / Firestore / Zod expose the foreign-key id (`ownerId`).

```yaml
fields:
  profile: { type: ProfileImage }              # embedded → Any + adapter
  owner:   { type: User, relation: true }      # relation → owner: User! / ownerId
```

## Data Connect operations

Query/mutation operations over a model's table. Emits `.gql` (over the
auto-generated `<table>_insert/update/upsert/delete` resolvers, with `@auth`
directives) plus TS `Variables`/`Result` types. Operations are **routed per
connector** — an operation may target several connectors and is emitted into
each, under `<connector>/operations.gql`.

```yaml
defaults:
  connectors: [app]        # file-level default for operations below

operations:
  CreateShop:
    type: mutation
    model: Shop
    action: insert                        # insert | update | upsert | delete
    auth: NO_ACCESS                       # NO_ACCESS | PUBLIC | USER
    connectors: [app, api]                # emitted into both connectors
    inputs: [type, ownerUser, name, slug, status]

  IncrementSeq:
    type: mutation
    model: Shop
    action: update
    inc: [projectNoSeq]                   # → projectNoSeq_update: { inc: 1 }
    exprs: { updatedAt: request.time }    # → updatedAt_expr: "request.time"

  SearchProducts:
    type: query
    model: Product
    auth: PUBLIC
    authReason: gated at the app layer    # required when auth is PUBLIC
    where:
      - { field: title, op: contains }    # eq | contains | lt | le | gt | ge | ne
      - status                            # shorthand → { field: status, op: eq }
    orderBy:
      - { field: createdAt, dir: DESC }
    limit: 20
    select: [id, title, status]

  UsageTotals:
    type: query
    model: UsageLog
    where: [{ field: shop, op: eq }]
    aggregate:
      count: true
      sum: [weightedAmount, inputTokens]
```

Relation inputs thread through as `owner: { id: $ownerId }`, matching Data
Connect's relation-reference form. Composite keys become `key: { a: $a, b: $b }`.

### Fidelity options

Everything below exists to reproduce real hand-written `.gql` files byte-for-byte:

| option | meaning |
| --- | --- |
| `gqlName` | document | rendered operation name (the yml key stays unique across services) |
| `footer` | document | trailing `# …` comment block after the operation |
| `raw` | document | emit the operation body verbatim (multi-model queries, `_or` keyset cursors — field checks are skipped) |
| `single: id \| document | key` | single-row lookup (`product(id: $id)` / `product(key: { … })`) |
| `keyArg` / `keyVars` | document | update/delete key argument form and variable renames |
| `whereAnd: true` | document | render conditions as an `_and: [ … ]` array |
| `entityDir` | document | override the `operations/<entity>/` output directory |
| `style` | document | formatting hints: `signature`, `args`, `data`, `orderBy`, `auth`, `key`, `and`, `where` (`inline`/`multi`/`compact`/`bare`) |

Inputs support `var` (variable rename), `required` (override optionality),
`literal` (fixed value, no variable), `flat` (write the FK column directly),
`inc` (increment write), and `asKey` (pass a relation as a `Model_Key` object
variable — `$catalogVersion: CatalogVersion_Key`). `where` fields support dotted
paths through relations (`review.catalog.id` → nested `review: { catalog: { id: { eq: … } } }`),
`literal` comparisons, and `flat` FK reads. `select` supports nested selections,
aliases, arguments, and reverse joins (`comments: reviewComments_on_product`).
`limit` may be a number or a variable (`{ var, default?, required? }`).

Operations are namespaced **per connector**: two operations may share a rendered
name as long as their connector sets don't overlap.

## API endpoints

Model application endpoints in three kind-implied sections — `apis:` (https /
callable, keyed by REST path), `tasks:` (Cloud Tasks), and `events:` (Pub/Sub).
The api-scoped generators — request/response types (`api-types`),
request-validation Zod (`api-validation`), class-validator DTOs (`api-dto`),
and payload contracts (`task-payloads`) — run for the entries that opt in via
the section `defaults` or the entry's own `generators:`. A payload references a
model or declares inline fields; a void response maps to `void`.

```yaml
envelopes:
  RetryTaskPayload:                        # RetryTaskPayload<T> = T & { … }
    fields:
      identifierId: string
      opId: string
      enqueuedAt: int

tasks:                                     # Cloud Tasks (kind implied)
  defaults:
    generators: [task-payloads]            # section default: applies to entries below
  createCatalog:
    envelope: RetryTaskPayload             # wraps the product data
    maxAttempts: 3
    request:
      fields:
        shopId: string
        catalogId: string
    response:
      void: true

events:                                    # Pub/Sub (kind implied)
  generateAiResponse:
    topic: ai-review-generate-response
    timeoutSeconds: 540
    generators: [task-payloads]

apis:                                      # https/callable, keyed by REST path
  defaults:
    generators: [api-types, api-validation]
  /shops/{slug}:
    operationId: getShopBySlug
    kind: callable                         # https (default) | callable
    request: { fields: { slug: { type: string, nonempty: true } } }
    response: { model: Shop }
    generators:                            # entry-level wins over section defaults;
      - api-types                          # an inline out overrides the declared template
      - { generator: api-dto, out: "src/entries/{path}" }
```

Generator application resolves in two tiers — the section `defaults`
(`apis:/tasks:/events:` → `defaults.generators`) and the entry's own
`generators:` (which replaces the defaults). `apis:` keys must be REST paths
(`/...` or `METHOD /...` so the same route can appear once per verb) with an
`operationId`; tasks and Pub/Sub events live in their own sections.

For `createCatalog` this yields `CreateCatalogTaskData`, `CreateCatalogTaskPayload =
RetryTaskPayload<CreateCatalogTaskData>`, and `CREATE_CATALOG_MAX_ATTEMPTS`, plus the
request types, Zod schema, and DTO.

## Firestore projections

Firestore is a **denormalized read model**, not the same shape as Data Connect.
A projection *derives* from a DC model (`from`) and applies the projection
reality automatically:

- **relations → resolved string ids** (`ownerUser` → `ownerUserId: z.string()`)
- **timestamps → `z.date()`**, optional fields → `.nullable()`
- a **`_meta_`** consistency envelope is attached (opt out with `meta: false`)
- `pick` / `omit` select which base fields survive
- inline `fields` add denormalized data (flattened DAG edges, stringified JSON)

```yaml
firestore:
  User:
    from: User
    collection: users/{userId}
    pick: [displayName, photoURL, createdAt, updatedAt, lastLoginAt]
  Product:
    from: Product
    collection: shops/{ws}/.../products/{productNo}
    omit: [catalog, log]
    fields:
      parentProductNos: { type: int, list: true }
      linkedCatalogTitle: { type: string, optional: true }
```

Emits Zod schemas + inferred types, mirroring a hand-written Firestore schema
library. (The simpler `firestore-types` generator just re-types *every* model
with the Firestore `Timestamp` and does not denormalize.)

With `firestore-split`, fields whose Zod chain is **identical** to the Data
Connect schema are reused via `.pick()` — only representation changes are
restated:

```ts
export const ShopSchema = DcShopSchema.pick({
  type: true, name: true, slug: true, ownerUserId: true, status: true,
}).extend({
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  _meta_: _Meta_Schema,
})
```

Additional projection options:

- **override semantics** — fields declared under `fields:` use `nullable:` →
  `.nullable()` and `optional:` → `.optional()` explicitly (base-picked fields
  map DC-optional → `.nullable()` automatically); `default:` → `.default(…)`
- **`pick` order is authoritative** for the projected field order
- **`helpers:`** — verbatim TypeScript (e.g. small accessor functions) emitted
  into the projection file
- **`include: [Model]`** — host a shared embedded schema in this file even when
  no projected field references it
- FS-only enums render as frozen consts (`REVIEW_STATE` + `ReviewStateSchema`),
  co-located with the first projection that references them

## Discriminated unions

```yaml
unions:
  CatalogOperationDraft:
    discriminant: operationType
    variants: [AddLinkOperation, CutLinkOperation]
```

Each variant is a model whose `operationType` field is pinned with `literal:` so
the output is a valid `z.discriminatedUnion('operationType', [...])` plus the TS
union type.

## SQL migrations

Constraints Data Connect cannot express — composite foreign keys, CHECK
constraints, extra indexes — are declared per model and emitted as an executable
`migrations/constraints.sql`:

```yaml
models:
  ProductLink:
    key: [catalog, parentProductNo, childProductNo]
    sql:
      checks:
        - "parent_product_no != child_product_no"
      foreignKeys:
        - { columns: [catalog_id, parent_product_no], references: "products(catalog_id, product_no)" }
      indexes:
        - { columns: [catalog_id, child_product_no] }
```

## Id codecs

For each model with an id field, the `id-codecs` generator emits typed
`encode<Model>Id` / `decode<Model>Id` wrappers (numeric codec for Int64 ids,
string codec otherwise) over generic primitives from a configurable `core`
module — replacing scattered untyped `encodeNumericId` calls.

## Project config

```yaml
project:
  services:
    - { name: shop, database: shop }
    - { name: warehouse, database: warehouse }
  codebases:
    shp: shop
  idCodec:
    minLength: 8
    alphabet: <your-shuffled-sqids-alphabet>
  aliases:
    "#contracts/*": libs/contracts/src/*
```

- `services` (`name`/`database`) feed the `FIRESTORE_DATABASES` constants in the
  `firestore-split` barrel.
- `idCodec` pins the Sqids settings as a contract constant; when present, the
  `id-codecs` generator also emits a self-contained `id-core.ts` (the
  encode/decode primitives), so nothing about id encoding lives outside the
  contract.
- `aliases` maps `#alias/...` out-template prefixes to paths relative to the
  **root** yml, so imported contracts can target shared libs without relative
  path gymnastics (longest prefix wins).
- `codebases` / service `location` + `connectors` are consumed by the optional
  `config` generator (preview), which emits per-service `dataconnect.yaml`,
  per-connector `connector.yaml`, and the `FIRESTORE_DATABASES` /
  `API_CODEBASES` sync constants. It does not yet reproduce every field of a
  real deployment config (e.g. `cloudSql` datasource details) — treat it as a
  starting point, not a drop-in replacement.

---

# Generators

| name                     | scope    | output                        | notes                                                  |
| ------------------------ | -------- | ----------------------------- | ------------------------------------------------------ |
| `typescript`             | document | `types.ts`                    | interfaces + const/union enums                         |
| `typescript-split`       | document | `types/<table>.ts` + `types.ts` barrel | one file per table; enums/embedded objects co-located |
| `zod`                    | document | `schemas.ts`                  | `z.object` schemas (constraints, `z.lazy` model refs)  |
| `zod-split`              | document | `schemas/<table>.ts` + `schemas.ts` barrel | split variant of `zod`                    |
| `data-connect-graphql`   | document | `schema.gql`                  | `type … @table(name, key)`; `@col`/`@unique`/`@index`/`@default` |
| `data-connect-graphql-split` | document | `schema/<table>.gql`     | same schema, one file per table (enums co-located) |
| `data-connect-operations`| document | `<connector>/operations.gql` + `.ts` | queries/mutations (where ops, orderBy, limit, aggregate, exprs, inc), per connector |
| `data-connect-operations-split` | document | `<connector>/operations/<entity>/{queries,mutations}.gql` | real Data Connect repo layout; shared types stay in `typescript`/`zod` outputs |
| `data-connect-adapter`   | document | `data-connect-adapters.ts`    | convert `Any` rows ⇄ logical types                     |
| `firestore-types`        | document | `firestore-types.ts`          | naive TS types with Firestore `Timestamp` (all models) |
| `firestore`              | document | `firestore.ts`                | Firestore projection Zod schemas (derived, denormalized) |
| `firestore-split`        | document | `firestore/<collection>.ts` + `firestore.ts` barrel | one file per projection; `_meta_` under `firestore/_/`; DC-schema `.pick()` reuse; `FIRESTORE_DATABASES` constants in the barrel |
| `api-types`              | api | `api-types.ts`                | endpoint request/response types                        |
| `api-validation`         | api | `api-validation.ts`           | endpoint request-validation Zod                        |
| `api-dto`                | api | `<operation>.dto.ts` per api  | class-validator DTO classes (NestJS `dto/` convention) |
| `task-payloads`          | api | `task-payloads.ts`            | envelopes + `*TaskData`/`*TaskPayload` + constants     |
| `sql-migrations`         | document | `migrations/constraints.sql`  | composite FK / CHECK / index SQL                       |
| `id-codecs`              | document | `id-codecs.ts` (+ `id-core.ts`) | typed per-entity id encode/decode wrappers; emits the Sqids primitives when `project.idCodec` is set |
| `unions`                 | document | `unions.ts`                   | Zod discriminated unions + TS union types              |
| `config`                 | document | `dataconnect.yaml`, `connector.yaml`, `constants.ts` | DC configs + sync constants (preview — see [Project config](#project-config)) |

Each generator emits nothing when its section is absent, so a small contract
produces a small output. Select a subset with `-g`.

**Scope** decides how a `generators:` declaration takes effect: `document`
generators run once for the yml that declares them; `api` generators run only
for the entries that apply them (section `defaults.generators` → entry
`generators:`, entry wins).

### The `Any` boundary

Data Connect stores JSON and embedded objects as the `Any` scalar, erasing the
logical type. The GraphQL generator keeps the logical type in a comment
(`metadata: Any # logical: ProductMetadata`), and the adapter emits typed
converters that call `fromAny`/`toAny` from `firebase-contract/runtime`:

```
ProductMetadata → Data Connect: Any → generated adapter → ProductMetadata
```

---

# Programmatic API

```ts
import { compile, generate, generateAll, createDefaultRegistry } from 'firebase-contract'

const { ir, diagnostics } = compile('contract.yml')

// Single target:
const result = generate('contract.yml', {
  outDir: 'generated',
  generators: ['typescript', 'zod'],   // omit for all
  write: true,
})

// Every generator declared across the import graph:
const all = generateAll('contract.yml', { write: true })
```

# Architecture

```
YAML → Parser → Import Resolver → Normalized IR → Semantic Validation → Generators
```

- **Generators never see YAML.** Their only input is the IR (`src/lib/_internal/ir`).
- **Generators are independent** of each other and of shared mutable state.
- **The CLI is thin** and delegates to the compiler; it never calls a generator
  directly.
- Dependency direction: `cli → compiler → {parser, resolver, ir, validation, generators}`.

All implementation lives under `src/lib/_internal` (imported via the `~internal`
alias); the outer layers are thin: `src/lib/cli/**` (bin), `src/lib/modules/**`
(public subpath exports, e.g. `firebase-contract/runtime`), and `src/index.ts`
(root barrel).

### Adding a generator

Implement the `Generator` interface and register it — no existing code changes:

```ts
import { Generator, createDefaultRegistry } from 'firebase-contract'

const openApi: Generator = {
  name: 'openapi',
  generate: ir => [{ path: 'openapi.json', content: toOpenApi(ir) }],
}

const registry = createDefaultRegistry().register(openApi)
```

### Adding a validation rule

Rules are independent `(ir) => Diagnostic[]` functions; pass a custom set to
`validateIr(ir, rules)`.
