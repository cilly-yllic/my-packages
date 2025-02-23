import type { ExecutorContext } from '@nx/devkit';
// import { exec } from 'child_process';
// import { promisify } from 'util';
import { write } from './generate-alias'

export interface EchoExecutorOptions {
  textToEcho: string;
}

export default async function executorExecutor(
  options: EchoExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
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
}