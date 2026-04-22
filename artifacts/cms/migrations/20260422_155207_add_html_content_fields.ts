import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cms"."posts"
      ADD COLUMN IF NOT EXISTS "content_html" varchar;

    ALTER TABLE "cms"."pages"
      ADD COLUMN IF NOT EXISTS "content_html" varchar;

    ALTER TABLE "cms"."services"
      ADD COLUMN IF NOT EXISTS "description_html" varchar;

    ALTER TABLE "cms"."team_members"
      ADD COLUMN IF NOT EXISTS "bio_html" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "cms"."posts"
      DROP COLUMN IF EXISTS "content_html";

    ALTER TABLE "cms"."pages"
      DROP COLUMN IF EXISTS "content_html";

    ALTER TABLE "cms"."services"
      DROP COLUMN IF EXISTS "description_html";

    ALTER TABLE "cms"."team_members"
      DROP COLUMN IF EXISTS "bio_html";
  `)
}
