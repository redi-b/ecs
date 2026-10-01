import type { createPlatformDb } from "@ecs/db";
import { type SQL, sql } from "drizzle-orm";

type Database = ReturnType<typeof createPlatformDb>["db"];
type ForeignKey = {
  child: string;
  parent: string;
  child_columns: string[];
  parent_columns: string[];
  nullable_columns: string[];
  delete_action: string;
};

/** Read the deployed FK graph, not a seed-maintained copy of the schema. */
export async function cleanDemoPlatformData(
  db: Database,
  scope: { tenantIds: string[]; organizationIds: string[]; userIds: string[] },
) {
  return db.transaction(async (tx) => {
    const keys = await tx.execute<ForeignKey>(sql`
      select child.relname as child, parent.relname as parent,
        array_agg(ca.attname::text order by pair.ordinality) as child_columns,
        array_agg(pa.attname::text order by pair.ordinality) as parent_columns,
        coalesce(array_agg(ca.attname::text order by pair.ordinality)
          filter (where not ca.attnotnull), '{}') as nullable_columns,
        fk.confdeltype::text as delete_action
      from pg_constraint fk
      join pg_class child on child.oid = fk.conrelid
      join pg_class parent on parent.oid = fk.confrelid
      join pg_namespace cn on cn.oid = child.relnamespace
      join pg_namespace pn on pn.oid = parent.relnamespace
      cross join lateral unnest(fk.conkey, fk.confkey)
        with ordinality as pair(child_num, parent_num, ordinality)
      join pg_attribute ca on ca.attrelid = child.oid and ca.attnum = pair.child_num
      join pg_attribute pa on pa.attrelid = parent.oid and pa.attnum = pair.parent_num
      where fk.contype = 'f' and cn.nspname = 'public' and pn.nspname = 'public'
      group by fk.oid, child.relname, parent.relname, fk.confdeltype
      order by child.relname, fk.oid
    `);
    const columns = await tx.execute<{ table_name: string; column_name: string }>(sql`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
    `);
    const table = (name: string) => sql`${sql.identifier("public")}.${sql.identifier(name)}`;
    const list = (values: string[]) =>
      sql.join(
        values.map((value) => sql`${value}`),
        sql`, `,
      );
    const hasRows = async (name: string, predicate: SQL) => {
      const result = await tx.execute<{ present: boolean }>(
        sql`select exists(select 1 from ${table(name)} where ${predicate}) as present`,
      );
      return result.rows[0]?.present === true;
    };

    async function remove(name: string, predicate: SQL, identity: boolean, path: string[]) {
      if (!(await hasRows(name, predicate))) return;
      if (path.includes(name)) {
        throw new Error(
          `Demo cleanup stopped at a populated FK cycle: ${[...path, name].join(" -> ")}`,
        );
      }
      // Never follow an identity/reference into another merchant's owned data.
      const guards: Array<[string, string[]]> = [
        ["tenant_id", scope.tenantIds],
        ["platform_tenant_id", scope.tenantIds],
        ["organization_id", scope.organizationIds],
        ...(name === "tenants" ? [["id", scope.tenantIds] as [string, string[]]] : []),
      ];
      for (const [column, allowed] of guards) {
        if (!columns.rows.some((row) => row.table_name === name && row.column_name === column))
          continue;
        const col = sql.identifier(column);
        const outside = allowed.length ? sql`${col} not in (${list(allowed)})` : sql`true`;
        if (await hasRows(name, sql`(${predicate}) and ${col} is not null and (${outside})`)) {
          throw new Error(`Demo cleanup refused unrelated data in ${name}.${column}`);
        }
      }
      for (const key of keys.rows.filter((key) => key.parent === name)) {
        const childCols = sql.join(key.child_columns.map(sql.identifier), sql`, `);
        const parentCols = sql.join(key.parent_columns.map(sql.identifier), sql`, `);
        const childPredicate = sql`(${childCols}) in
          (select ${parentCols} from ${table(name)} where ${predicate})`;
        if (!(await hasRows(key.child, childPredicate))) continue;
        if ((identity || key.delete_action === "n") && key.nullable_columns.length) {
          // Shared previews, media and published content survive demo-author removal.
          const assignments = sql.join(
            key.nullable_columns.map((column) => sql`${sql.identifier(column)} = null`),
            sql`, `,
          );
          await tx.execute(
            sql`update ${table(key.child)} set ${assignments} where ${childPredicate}`,
          );
        } else {
          const scoped = columns.rows.some(
            (row) =>
              row.table_name === key.child &&
              ["tenant_id", "platform_tenant_id", "organization_id"].includes(row.column_name),
          );
          if (identity && key.delete_action !== "c" && !scoped) {
            throw new Error(`Demo cleanup refused a required shared reference in ${key.child}`);
          }
          await remove(key.child, childPredicate, identity || key.child === "platform_principals", [
            ...path,
            name,
          ]);
        }
      }
      await tx.execute(sql`delete from ${table(name)} where ${predicate}`);
    }

    if (scope.tenantIds.length) {
      await remove("tenants", sql`id in (${list(scope.tenantIds)})`, false, []);
    }
    if (scope.organizationIds.length) {
      await remove("organizations", sql`id in (${list(scope.organizationIds)})`, false, []);
    }
    if (scope.userIds.length) {
      await remove("users", sql`id in (${list(scope.userIds)})`, true, []);
    }
  });
}
