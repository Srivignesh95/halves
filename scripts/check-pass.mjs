process.loadEnvFile(".env");
const p = process.env.SMTP_PASS || "";
console.log({
  length: p.length,
  first: p[0],
  last: p.at(-1),
  hasSpace: /\s/.test(p),
  hasQuote: /["']/.test(p),
  hasHash: p.includes("#"),
});