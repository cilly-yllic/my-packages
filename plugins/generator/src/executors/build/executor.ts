import { PromiseExecutor, ExecutorContext, runExecutor as _runExecutor } from '@nx/devkit';
import { BuildExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<BuildExecutorSchema> = async (options: BuildExecutorSchema, context: ExecutorContext) => {
  console.log('Running build...');
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
  const packageJsonsResult = await _runExecutor(
    { project: context.projectName || '', target: 'package-jsons' },
    options,
    context
  );
  
  for await (const result of replaceAliasesResult) {
    if (!result.success) {
      console.error('replace aliases failed');
      return { success: false };
    }
  }
  for await (const result of packageJsonsResult) {
    if (!result.success) {
      console.error('package jsons failed');
      return { success: false };
    }
  }
  return {
    success: true,
  };
};

export default runExecutor;
