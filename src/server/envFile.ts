// Backend-only helper: persist key=value pairs into a .env file
// (replace in place or append) and mirror them into process.env.

import fs from "fs";
import path from "path";

export const updateEnvFile = (
  updates: Record<string, string>,
  envPath: string = path.join(process.cwd(), ".env")
): void => {
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  }
  const lines = content.split(/\r?\n/);
  for (const [key, val] of Object.entries(updates)) {
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(`${key}=`)) {
        lines[i] = `${key}=${val}`;
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push(`${key}=${val}`);
    }
    process.env[key] = val;
  }
  fs.writeFileSync(envPath, lines.join("\n"), { encoding: "utf-8", mode: 0o600 });
};
