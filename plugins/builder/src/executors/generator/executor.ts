import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { GeneratorExecutorSchema } from './schema';

import { write } from './utils/generate-alias'

const runExecutor: PromiseExecutor<GeneratorExecutorSchema> = async (
  options: GeneratorExecutorSchema,
  context: ExecutorContext
) => {
  console.log('Executor ran for Generator', options);
  console.info(`Options: ${JSON.stringify(options, null, 2)}`);
  // console.info(`context: ${JSON.stringify(context, null, 2)}`);
  console.info('projectName', context.projectName)
  console.info('cwd', context.cwd)
  console.info('configurationName', context.configurationName)
  console.info('root', context.root)
  console.info('projectsConfigurations', JSON.stringify(context.projectsConfigurations.projects[context.projectName as any].root, null, 2))
  const projectRoot = context.projectsConfigurations.projects[context.projectName as any].root
  write(projectRoot, context.projectName || '')
  return {
    success: true,
  };
};

export default runExecutor;
