import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, ''); // guard against leading underscore on already-uppercase first char
}

/**
 * Maps camelCase TypeScript entity property names to snake_case Postgres column names.
 * Required because all migrations use snake_case column naming (e.g. created_at, user_id).
 * Without this strategy TypeORM defaults to the property name verbatim (createdAt → "createdAt"),
 * which doesn't match the physical column.
 */
export class SnakeCaseNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override tableName(className: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? toSnakeCase(className);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const prefix = embeddedPrefixes.map(toSnakeCase).join('_');
    const col = customName ?? toSnakeCase(propertyName);
    return prefix ? `${prefix}_${col}` : col;
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return toSnakeCase(`${firstTableName}_${firstPropertyName}_${secondTableName}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
