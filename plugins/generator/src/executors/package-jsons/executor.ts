import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { PackageJsonsExecutorSchema } from './schema';

import { write } from './utils/generate-alias'

const runExecutor: PromiseExecutor<PackageJsonsExecutorSchema> = async (
  options: PackageJsonsExecutorSchema,
  context: ExecutorContext
) => {
  console.info(`Executing "echo"...`);
  console.info(`Options: ${JSON.stringify(options, null, 2)}`);
  // console.info(`context: ${JSON.stringify(context, null, 2)}`);
  console.info('projectName', context.projectName)
  console.info('cwd', context.cwd)
  console.info('configurationName', context.configurationName)
  console.info('root', context.root)
  console.info('projectsConfigurations', JSON.stringify(context.projectsConfigurations.projects[context.projectName as any].root, null, 2))
  console.log('hoge');
  const projectRoot = context.projectsConfigurations.projects[context.projectName as any].root
  // const { stdout, stderr } = await promisify(exec)(
  //   `echo ${options.textToEcho}`
  // );
  write(projectRoot, context.projectName || '')
  // console.log(stdout);
  // console.error(stderr);
  return { success: true };
};

export default runExecutor;