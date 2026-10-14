import { createApp } from "./app.js";
import { remoteJwks } from "./auth.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";

const config = loadConfig();
const db = openDb(config.dbPath);

const app = createApp(db, {
  issuer: config.issuer,
  audience: config.audience,
  jwks: remoteJwks(config.jwksUrl),
});

const server = app.listen(config.port, config.host, () => {
  console.log(`SecureMCP listening on http://${config.host}:${config.port}/mcp`);
  console.log(`Trusting tokens from ${config.issuer} (aud=${config.audience})`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
