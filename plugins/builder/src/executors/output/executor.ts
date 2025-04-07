import { PromiseExecutor } from '@nx/devkit';
import { OutputExecutorSchema } from './schema';

const runExecutor: PromiseExecutor<OutputExecutorSchema> = async (options) => {
  console.log('Executor ran for Output', options);
  return {
    success: true,
  };
};

export default runExecutor;
