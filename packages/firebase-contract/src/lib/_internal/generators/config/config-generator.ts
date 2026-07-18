import { Ir, IrProject, IrService } from '../../ir/ir.js'
import { constantCase, singleQuote } from '../support/naming.js'
import { GeneratedFile, Generator, GeneratorContext } from '../generator.js'
import { headerFor } from '../support/header.js'

const DEFAULT_LOCATION = 'asia-northeast1'

const dataconnectYaml = (service: IrService): string => {
  const connectorDirs = service.connectors.map(c => `./connectors/${c}`)
  return [
    'specVersion: v1beta',
    `serviceId: ${service.name}`,
    `location: ${service.location ?? DEFAULT_LOCATION}`,
    'schema:',
    '  source: ./schema',
    ...(service.database ? ['  datasource:', '    postgresql:', `      database: ${service.database}`] : []),
    `connectorDirs: [${connectorDirs.map(d => `'${d}'`).join(', ')}]`,
    '',
  ].join('\n')
}

const connectorYaml = (service: IrService, connector: string): string =>
  [
    `connectorId: ${connector}`,
    'generate:',
    '  javascriptSdk:',
    `    outputDir: ../../../dataconnect-generated/${connector}`,
    `    package: '@dataconnect/${service.name}-generated-${connector}'`,
    '    react: true',
    '',
  ].join('\n')

const constantsTs = (project: IrProject, header: string): string => {
  const blocks = header ? [header] : []
  if (project.services.length > 0) {
    const entries = project.services
      .map(s => `  ${constantCase(s.name)}: ${singleQuote(s.database ?? s.name)},`)
      .join('\n')
    blocks.push(
      `export const FIRESTORE_DATABASES = Object.freeze({\n${entries}\n} as const)`,
      'export type FirestoreDatabaseKey = keyof typeof FIRESTORE_DATABASES'
    )
  }
  if (project.codebases.length > 0) {
    const entries = project.codebases
      .map(c => `  ${constantCase(c.service)}: ${singleQuote(c.codebase)},`)
      .join('\n')
    blocks.push(
      `export const API_CODEBASES = Object.freeze({\n${entries}\n} as const)`,
      'export type ApiCodebaseKey = keyof typeof API_CODEBASES'
    )
  }
  return `${blocks.join('\n\n')}\n`
}

/**
 * Generates project topology artifacts from a single source: per-service Data
 * Connect `dataconnect.yaml`, per-connector `connector.yaml` (package/outputDir
 * are pure string formulas), and the sync constants (`FIRESTORE_DATABASES`,
 * `API_CODEBASES`) that would otherwise be kept in sync by hand.
 */
export const createConfigGenerator = (): Generator => ({
  name: 'config',
  description: 'Data Connect service/connector configs + project sync constants',
  generate(ir: Ir, context?: GeneratorContext): GeneratedFile[] {
    const project = ir.project
    if (!project) {
      return []
    }
    const files: GeneratedFile[] = []
    for (const service of project.services) {
      files.push({ path: `${service.name}/dataconnect.yaml`, content: dataconnectYaml(service) })
      for (const connector of service.connectors) {
        files.push({
          path: `${service.name}/connectors/${connector}/connector.yaml`,
          content: connectorYaml(service, connector),
        })
      }
    }
    if (project.services.length > 0 || project.codebases.length > 0) {
      files.push({ path: 'constants.ts', content: constantsTs(project, headerFor(context)) })
    }
    return files
  },
})
