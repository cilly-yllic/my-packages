import { Generator } from './generator.js'

/**
 * Holds the set of available generators keyed by name. The compiler resolves
 * requested generators through the registry, so adding a new generator is just
 * a `register` call — no existing code changes.
 */
export class GeneratorRegistry {
  private readonly generators = new Map<string, Generator>()

  register(generator: Generator): this {
    this.generators.set(generator.name, generator)
    return this
  }

  has(name: string): boolean {
    return this.generators.has(name)
  }

  get(name: string): Generator | undefined {
    return this.generators.get(name)
  }

  names(): string[] {
    return [...this.generators.keys()]
  }

  list(): Generator[] {
    return [...this.generators.values()]
  }
}
