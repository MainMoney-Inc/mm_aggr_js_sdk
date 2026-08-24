import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let url = "http://127.0.0.1:8000";
try {
  const env = readFileSync(join(root, ".env"), "utf8");
  const match = env.match(/^VITE_MERCHANT_BACKEND_URL=(.*)$/m);
  if (match) {
    url = match[1].trim();
  }
} catch {
  // use default
}
writeFileSync(
  join(root, "src/environments/environment.local.ts"),
  `export const environment = { merchantBackendUrl: ${JSON.stringify(url)} };\n`,
);
