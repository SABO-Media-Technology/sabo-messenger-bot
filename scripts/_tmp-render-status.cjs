const fs = require("fs");
for (const line of fs.readFileSync("D:/0.PROJECTS/.env.secrets", "utf8").split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq < 1 || line.startsWith("#")) continue;
  process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const sid = "srv-d8psv69194ac739luu00";
const key = process.env.RENDER_API_KEY;
(async () => {
  const h = { Authorization: "Bearer " + key, Accept: "application/json" };
  const events = await fetch("https://api.render.com/v1/services/" + sid + "/events?limit=30", { headers: h }).then(r=>r.json());
  for (const row of Array.isArray(events) ? events : []) {
    const e = row.event || row;
    const det = e.details != null ? JSON.stringify(e.details).slice(0, 300) : e.message || "";
    console.log(e.timestamp, e.type, det);
  }
  const health = await fetch("https://sabo-messenger-bot.onrender.com/health", { signal: AbortSignal.timeout(15000) });
  console.log("HEALTH", health.status, await health.text());
})();
