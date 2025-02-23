import { ExecutorContext } from '@nx/devkit';

import { GenerateRecursivePackageJsonExecutorSchema } from './schema';
import executor from './executor';

const options: GenerateRecursivePackageJsonExecutorSchema = {};
const context: ExecutorContext = {
  root: '',
  cwd: process.cwd(),
  isVerbose: false,
  projectGraph: {
    nodes: {},
    dependencies: {},
  },
  projectsConfigurations: {
    projects: {},
    version: 2,
  },
  nxJsonConfiguration: {},
};

describe('GenerateRecursivePackageJson Executor', () => {
  it('can run', async () => {
    const output = await executor(options, context);
    expect(output.success).toBe(true);
  });
});
