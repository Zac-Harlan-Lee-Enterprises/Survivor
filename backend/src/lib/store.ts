/**
 * Minimal table abstraction so routes can be unit-tested against an
 * in-memory store and run against DynamoDB in production.
 */
export interface Item {
  PK: string
  SK: string
  [key: string]: unknown
}

export class ConditionFailed extends Error {
  constructor(message = 'Conditional write failed') {
    super(message)
    this.name = 'ConditionFailed'
  }
}

export interface PutOptions {
  /** Only write when no item exists at (PK, SK). */
  ifNotExists?: boolean
  /** Only write when item[attr] equals value (optimistic concurrency). */
  ifEquals?: { attr: string; value: unknown }
}

export interface QueryOptions {
  limit?: number
  descending?: boolean
}

export interface TableStore {
  get(PK: string, SK: string): Promise<Item | null>
  put(item: Item, options?: PutOptions): Promise<void>
  delete(PK: string, SK: string): Promise<void>
  query(PK: string, prefix?: string, options?: QueryOptions): Promise<Item[]>
  batchGet(keys: Array<{ PK: string; SK: string }>): Promise<Item[]>
}

/** In-memory implementation for tests and local development. */
export class MemoryStore implements TableStore {
  private items = new Map<string, Item>()

  private key(PK: string, SK: string): string {
    return `${PK} ${SK}`
  }

  async get(PK: string, SK: string): Promise<Item | null> {
    const v = this.items.get(this.key(PK, SK))
    return v ? structuredClone(v) : null
  }

  async put(item: Item, options: PutOptions = {}): Promise<void> {
    const existing = this.items.get(this.key(item.PK, item.SK))
    if (options.ifNotExists && existing) throw new ConditionFailed()
    if (options.ifEquals) {
      if (!existing) throw new ConditionFailed()
      if (existing[options.ifEquals.attr] !== options.ifEquals.value) throw new ConditionFailed()
    }
    this.items.set(this.key(item.PK, item.SK), structuredClone(item))
  }

  async delete(PK: string, SK: string): Promise<void> {
    this.items.delete(this.key(PK, SK))
  }

  async query(PK: string, prefix = '', options: QueryOptions = {}): Promise<Item[]> {
    const rows = [...this.items.values()]
      .filter((i) => i.PK === PK && i.SK.startsWith(prefix))
      .sort((a, b) => a.SK.localeCompare(b.SK))
    if (options.descending) rows.reverse()
    return structuredClone(options.limit ? rows.slice(0, options.limit) : rows)
  }

  async batchGet(keys: Array<{ PK: string; SK: string }>): Promise<Item[]> {
    const out: Item[] = []
    for (const k of keys) {
      const v = this.items.get(this.key(k.PK, k.SK))
      if (v) out.push(structuredClone(v))
    }
    return out
  }

  size(): number {
    return this.items.size
  }
}
