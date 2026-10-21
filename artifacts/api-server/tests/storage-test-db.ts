import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../lib/db/src/schema/schema";

// The test runner aliases storage's ./db import here: no PostgreSQL URL or network.
export const client = new PGlite();
export const db = drizzle(client, { schema });
