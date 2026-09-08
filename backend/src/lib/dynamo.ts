import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  ConditionFailed,
  type Item,
  type PutOptions,
  type QueryOptions,
  type TableStore,
} from './store'

/** DynamoDB implementation of TableStore (one on-demand table). */
export class DynamoStore implements TableStore {
  private readonly doc: DynamoDBDocumentClient
  private readonly tableName: string

  constructor(tableName: string, client: DynamoDBClient = new DynamoDBClient({})) {
    this.tableName = tableName
    this.doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    })
  }

  async get(PK: string, SK: string): Promise<Item | null> {
    const r = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { PK, SK } }))
    return (r.Item as Item | undefined) ?? null
  }

  async put(item: Item, options: PutOptions = {}): Promise<void> {
    let ConditionExpression: string | undefined
    let ExpressionAttributeNames: Record<string, string> | undefined
    let ExpressionAttributeValues: Record<string, unknown> | undefined
    if (options.ifNotExists) {
      ConditionExpression = 'attribute_not_exists(PK)'
    } else if (options.ifEquals) {
      ConditionExpression = '#a = :v'
      ExpressionAttributeNames = { '#a': options.ifEquals.attr }
      ExpressionAttributeValues = { ':v': options.ifEquals.value }
    }
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression,
          ExpressionAttributeNames,
          ExpressionAttributeValues,
        }),
      )
    } catch (err) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException')
        throw new ConditionFailed()
      throw err
    }
  }

  async delete(PK: string, SK: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { PK, SK } }))
  }

  async query(PK: string, prefix = '', options: QueryOptions = {}): Promise<Item[]> {
    const items: Item[] = []
    let ExclusiveStartKey: Record<string, unknown> | undefined
    do {
      const r = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: prefix ? 'PK = :pk AND begins_with(SK, :sk)' : 'PK = :pk',
          ExpressionAttributeValues: prefix ? { ':pk': PK, ':sk': prefix } : { ':pk': PK },
          ScanIndexForward: !options.descending,
          Limit: options.limit,
          ExclusiveStartKey,
        }),
      )
      items.push(...((r.Items as Item[] | undefined) ?? []))
      ExclusiveStartKey = r.LastEvaluatedKey
      if (options.limit && items.length >= options.limit) break
    } while (ExclusiveStartKey)
    return options.limit ? items.slice(0, options.limit) : items
  }

  async batchGet(keys: Array<{ PK: string; SK: string }>): Promise<Item[]> {
    const out: Item[] = []
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100)
      const r = await this.doc.send(
        new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: chunk } } }),
      )
      out.push(...((r.Responses?.[this.tableName] as Item[] | undefined) ?? []))
    }
    return out
  }
}
