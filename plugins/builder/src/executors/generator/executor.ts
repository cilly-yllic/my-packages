import { PromiseExecutor } from '@nx/devkit';
import { GeneratorExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<GeneratorExecutorSchema> = async (
  options
) => {
  console.log('Executor ran for Generator', options);
  return {
    success: true,
  };
};

export default runExecutor;
