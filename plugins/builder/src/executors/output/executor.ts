import { PromiseExecutor, ExecutorContext, runExecutor as _runExecutor } from '@nx/devkit';
import { OutputExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<OutputExecutorSchema> = async (options: OutputExecutorSchema, context: ExecutorContext) => {
  console.log('Executor ran for Output', context.projectName);
  const buildResult = await _runExecutor(
    { project: context.projectName || '', target: 'build' },
    options,
    context
  );
  
  for await (const result of buildResult) {
    if (!result.success) {
      console.error('Build failed');
      return { success: false };
    }
  }
  
  console.log('Running replace-aliases task...');
  const replaceAliasesResult = await _runExecutor(
    { project: context.projectName || '', target: 'replace-aliases' },
    options,
    context
  );
  
  console.log('Running package-jsons task...');
  const generatorResult = await _runExecutor(
    { project: context.projectName || '', target: 'generator' },
    options,
    context
  );
  
  for await (const result of replaceAliasesResult) {
    if (!result.success) {
      console.error('replace aliases failed');
      return { success: false };
    }
  }
  for await (const result of generatorResult) {
    if (!result.success) {
      console.error('generator failed');
      return { success: false };
    }
  }
  return {
    success: true,
  };
};

export default runExecutor;
