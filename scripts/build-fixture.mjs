import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, "sample-statement.csv");
const outPath = join(__dirname, "../src/shots/fixture.json");

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseAmount(amountStr) {
  if (!amountStr || amountStr === "-" || amountStr.trim() === "") return null;
  const cleaned = amountStr.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : Math.abs(parsed);
}

const csv = readFileSync(csvPath, "utf8");
const lines = csv.split("\n").filter((l) => l.trim());
let headerIndex = -1;
for (let i = 0; i < lines.length; i++) {
  const lower = lines[i].toLowerCase();
  if (
    lower.includes("receipt") &&
    lower.includes("completion") &&
    (lower.includes("details") || lower.includes("transaction"))
  ) {
    headerIndex = i;
    break;
  }
}

const transactions = [];
for (let i = headerIndex + 1; i < lines.length; i++) {
  const line = lines[i];
  const fields = parseCSVLine(line);
  if (fields.length < 4) continue;
  if (fields[0]?.toLowerCase().includes("receipt")) continue;

  const tx = {
    receiptNo: fields[0]?.trim().replace(/\r/g, " ") || "",
    completionTime: fields[1]?.trim().replace(/\r/g, " ") || "",
    details: fields[2]?.trim().replace(/\r/g, " ") || "",
    transactionStatus: fields[3]?.trim().replace(/\r/g, " ") || "Unknown",
    paidIn: parseAmount(fields[4]),
    withdrawn: parseAmount(fields[5]),
    balance: parseAmount(fields[6]) || 0,
    raw: line,
  };
  if (!tx.receiptNo && !tx.completionTime) continue;
  // Skip summary-style rows
  if (tx.receiptNo.toUpperCase().includes("TRANSACTION TYPE")) continue;
  if (!/^[A-Z0-9]{6,}/.test(tx.receiptNo.replace(/\s/g, ""))) continue;
  transactions.push(tx);
}

transactions.sort(
  (a, b) =>
    new Date(a.completionTime).getTime() - new Date(b.completionTime).getTime()
);

const totalCharges = transactions
  .filter((t) => t.details.toLowerCase().includes("charge"))
  .reduce((sum, t) => sum + (t.withdrawn || t.paidIn || 0), 0);

const fixture = {
  fileName: "MPESA_Statement_2025-09-25_to_2025-09-01.pdf",
  statement: {
    fileName: "MPESA_Statement_2025-09-25_to_2025-09-01.pdf",
    transactions,
    totalCharges,
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fixture, null, 2));
console.log(
  `Wrote fixture with ${transactions.length} transactions, charges=${totalCharges} → ${outPath}`
);
