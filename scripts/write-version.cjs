const fs = require("fs");
const path = require("path");

const versionPath = path.resolve(__dirname, "..", "version.json");
const now = new Date();

const data = {
  version: now.toISOString(),
  generatedAt: now.toISOString(),
};

fs.writeFileSync(versionPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("[WindCloud] Wrote version.json:", data.version);

