import { createApiDtoGenerator } from './api/api-dto-generator.js'
import { createApiTypesGenerator } from './api/api-types-generator.js'
import { createApiValidationGenerator } from './api/api-validation-generator.js'
import { createTaskPayloadGenerator } from './api/task-payload-generator.js'
import { createConfigGenerator } from './config/config-generator.js'
import { createDataConnectAdapterGenerator } from './data-connect/adapter-generator.js'
import { createDataConnectGraphqlGenerator } from './data-connect/graphql-generator.js'
import { createDataConnectOperationsGenerator } from './data-connect/operations-generator.js'
import { createFirestoreProjectionGenerator } from './firestore/firestore-projection-generator.js'
import { createFirestoreTypeGenerator } from './firestore/firestore-type-generator.js'
import { createIdCodecGenerator } from './id/id-codec-generator.js'
import { createSqlMigrationGenerator } from './sql/sql-migration-generator.js'
import { createUnionGenerator } from './union/union-generator.js'
import { GeneratorRegistry } from './registry.js'
import { createTypeScriptGenerator } from './typescript/typescript-generator.js'
import { createZodGenerator } from './zod/zod-generator.js'

export type { GeneratedFile, Generator, GeneratorContext } from './generator.js'
export { GeneratorRegistry } from './registry.js'
export { createTypeScriptGenerator } from './typescript/typescript-generator.js'
export type { TypeScriptGeneratorOptions } from './typescript/typescript-generator.js'
export { createZodGenerator } from './zod/zod-generator.js'
export { createDataConnectGraphqlGenerator } from './data-connect/graphql-generator.js'
export { createDataConnectAdapterGenerator } from './data-connect/adapter-generator.js'
export { createDataConnectOperationsGenerator } from './data-connect/operations-generator.js'
export { createFirestoreTypeGenerator } from './firestore/firestore-type-generator.js'
export type { FirestoreGeneratorOptions } from './firestore/firestore-type-generator.js'
export { createFirestoreProjectionGenerator } from './firestore/firestore-projection-generator.js'
export { createApiTypesGenerator } from './api/api-types-generator.js'
export { createApiValidationGenerator } from './api/api-validation-generator.js'
export { createApiDtoGenerator } from './api/api-dto-generator.js'
export { createTaskPayloadGenerator } from './api/task-payload-generator.js'
export { createSqlMigrationGenerator } from './sql/sql-migration-generator.js'
export { createIdCodecGenerator } from './id/id-codec-generator.js'
export type { IdCodecGeneratorOptions } from './id/id-codec-generator.js'
export { createUnionGenerator } from './union/union-generator.js'
export { createConfigGenerator } from './config/config-generator.js'

/**
 * Build a registry populated with the built-in generators:
 * TypeScript, Zod, Data Connect (GraphQL schema / operations / adapter),
 * Firestore types, and the API layer (types / request validation).
 */
export const createDefaultRegistry = (): GeneratorRegistry =>
  new GeneratorRegistry()
    .register(createTypeScriptGenerator())
    .register(createZodGenerator())
    .register(createDataConnectGraphqlGenerator())
    .register(createDataConnectOperationsGenerator())
    .register(createDataConnectAdapterGenerator())
    .register(createFirestoreTypeGenerator())
    .register(createFirestoreProjectionGenerator())
    .register(createApiTypesGenerator())
    .register(createApiValidationGenerator())
    .register(createApiDtoGenerator())
    .register(createTaskPayloadGenerator())
    .register(createSqlMigrationGenerator())
    .register(createIdCodecGenerator())
    .register(createUnionGenerator())
    .register(createConfigGenerator())
