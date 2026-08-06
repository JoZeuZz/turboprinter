import path from "node:path";
import { migrateLocalConfig } from "../src/server/localConfigMigration";

const apply = process.argv.includes("--apply");
const result = migrateLocalConfig({
  envPath: path.join(process.cwd(), ".env"),
  tomlPath: path.join(process.cwd(), "config.toml"),
  apply,
});

console.log(`[Config migration] mode=${apply ? "apply" : "check"}`);
console.log(`[Config migration] migrated=${result.migrated.join(",") || "none"}`);
console.log(`[Config migration] preserved=${result.preserved.join(",") || "none"}`);
console.log(`[Config migration] conflicts=${result.conflicts.join(",") || "none"}`);

if (result.conflicts.length > 0) process.exitCode = 2;
