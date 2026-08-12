import { MPesaStatement, Transaction } from "../../types";
import * as ExcelJS from "exceljs";

export type ReversalKind = "send_money" | "globalpay" | "generic";

export interface LinkedReversal {
  reversal: Transaction;
  kind: ReversalKind;
  kindLabel: string;
  amount: number;
  direction: "In" | "Out";
  counterparty: string | null;
  linked: Transaction | null;
  linkMethod: string | null;
}

/** Collapse PDF line-breaks so regexes see a single details line. */
export function normalizeDetails(details: string): string {
  return details.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isReversalTransaction(transaction: Transaction): boolean {
  return /reversal/i.test(transaction.details);
}

export function classifyReversal(details: string): ReversalKind {
  const d = normalizeDetails(details);
  if (/send money reversal/i.test(d)) return "send_money";
  if (/globalpay reversal/i.test(d)) return "globalpay";
  return "generic";
}

function kindLabel(kind: ReversalKind): string {
  switch (kind) {
    case "send_money":
      return "Send Money Reversal";
    case "globalpay":
      return "GlobalPay Reversal";
    default:
      return "Reversal";
  }
}

function transactionAmount(transaction: Transaction): number {
  if (transaction.paidIn != null && transaction.paidIn !== 0) {
    return Math.abs(transaction.paidIn);
  }
  if (transaction.withdrawn != null && transaction.withdrawn !== 0) {
    return Math.abs(transaction.withdrawn);
  }
  return 0;
}

function transactionDirection(transaction: Transaction): "In" | "Out" {
  if (transaction.paidIn != null && Math.abs(transaction.paidIn) > 0) {
    return "In";
  }
  return "Out";
}

/**
 * Extract a stable party key for P2P matching across mask variants
 * (e.g. 0740***636 vs 07******636) plus the visible name.
 */
export function partyMatchKey(text: string): string {
  const d = normalizeDetails(text);
  const digits = d.replace(/\D/g, "");
  const lastDigits = digits.slice(-3);
  const name = d
    .replace(/[\d*]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return `${lastDigits}|${name}`;
}

export function extractReversalCounterparty(
  details: string,
  kind: ReversalKind
): string | null {
  const d = normalizeDetails(details);

  if (kind === "send_money") {
    const match = d.match(/Send Money Reversal via API to\s*-?\s*(.+)$/i);
    return match?.[1]?.trim() || null;
  }

  if (kind === "globalpay") {
    const match = d.match(
      /GlobalPay reversal from\s+(\d+)\s*-\s*(.+?)(?:\s+Acc\.\s*(.+))?$/i
    );
    if (!match) return null;
    const paybill = match[1];
    const name = match[2].trim();
    const acc = match[3]?.trim();
    return acc ? `${paybill} - ${name} Acc. ${acc}` : `${paybill} - ${name}`;
  }

  const forReceipt = d.match(/Reversal for\s+(\S+)/i);
  if (forReceipt) return forReceipt[1];

  return null;
}

function extractPaybillNumber(details: string): string | null {
  const d = normalizeDetails(details);
  const match = d.match(
    /(?:GlobalPay reversal from|Card Pay Bill(?: Online)? to)\s+(\d+)/i
  );
  return match?.[1] || null;
}

function extractFundsReceivedParty(details: string): string | null {
  const d = normalizeDetails(details);
  const match = d.match(/Funds received from\s*-?\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

function parseCompletionTime(value: string): number {
  const ts = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(ts) ? 0 : ts;
}

function findLinkedOriginal(
  reversal: Transaction,
  kind: ReversalKind,
  amount: number,
  candidates: Transaction[]
): { linked: Transaction | null; linkMethod: string | null } {
  const reversalTime = parseCompletionTime(reversal.completionTime);
  const prior = candidates.filter((t) => {
    if (t === reversal) return false;
    if (isReversalTransaction(t)) return false;
    if (t.details.toLowerCase().includes("charge")) return false;
    const tTime = parseCompletionTime(t.completionTime);
    // Prefer earlier rows; allow same-second / slightly later PDF ordering noise
    return tTime <= reversalTime + 60_000;
  });

  if (kind === "send_money") {
    const party = extractReversalCounterparty(reversal.details, kind);
    if (!party) return { linked: null, linkMethod: null };
    const key = partyMatchKey(party);

    const matches = prior
      .filter((t) => {
        const receivedParty = extractFundsReceivedParty(t.details);
        if (!receivedParty) return false;
        if (partyMatchKey(receivedParty) !== key) return false;
        return Math.abs(transactionAmount(t) - amount) < 0.005;
      })
      .sort(
        (a, b) =>
          parseCompletionTime(b.completionTime) -
          parseCompletionTime(a.completionTime)
      );

    if (matches[0]) {
      return { linked: matches[0], linkMethod: "counterparty + amount" };
    }
  }

  if (kind === "globalpay") {
    const paybill = extractPaybillNumber(reversal.details);
    if (!paybill) return { linked: null, linkMethod: null };

    const matches = prior
      .filter((t) => {
        if (!/Card Pay Bill/i.test(t.details)) return false;
        if (extractPaybillNumber(t.details) !== paybill) return false;
        return Math.abs(transactionAmount(t) - amount) < 0.005;
      })
      .sort(
        (a, b) =>
          parseCompletionTime(b.completionTime) -
          parseCompletionTime(a.completionTime)
      );

    if (matches[0]) {
      return { linked: matches[0], linkMethod: "paybill + amount" };
    }
  }

  // Generic: "Reversal for RECEIPT" or same-receipt non-reversal twin
  const forReceipt = normalizeDetails(reversal.details).match(
    /Reversal for\s+(\S+)/i
  );
  if (forReceipt) {
    const target = forReceipt[1];
    const byReceipt = prior.find((t) => t.receiptNo === target);
    if (byReceipt) {
      return { linked: byReceipt, linkMethod: "receipt in details" };
    }
  }

  const sameReceipt = prior.filter(
    (t) =>
      t.receiptNo === reversal.receiptNo &&
      Math.abs(transactionAmount(t) - amount) < 0.005
  );
  if (sameReceipt.length === 1) {
    return { linked: sameReceipt[0], linkMethod: "shared receipt" };
  }

  return { linked: null, linkMethod: null };
}

export function buildLinkedReversals(
  statement: MPesaStatement
): LinkedReversal[] {
  const reversals = statement.transactions.filter(isReversalTransaction);
  if (reversals.length === 0) return [];

  return reversals
    .map((reversal) => {
      const kind = classifyReversal(reversal.details);
      const amount = transactionAmount(reversal);
      const { linked, linkMethod } = findLinkedOriginal(
        reversal,
        kind,
        amount,
        statement.transactions
      );

      return {
        reversal,
        kind,
        kindLabel: kindLabel(kind),
        amount,
        direction: transactionDirection(reversal),
        counterparty: extractReversalCounterparty(reversal.details, kind),
        linked,
        linkMethod,
      };
    })
    .sort(
      (a, b) =>
        parseCompletionTime(b.reversal.completionTime) -
        parseCompletionTime(a.reversal.completionTime)
    );
}

export function addReversalsSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  const rows = buildLinkedReversals(statement);
  // Always create the sheet when the option is selected so the toggle is never
  // a silent no-op (statements with no reversals get an empty-state message).
  const worksheet = workbook.addWorksheet("Reversals");

  worksheet.columns = [
    { header: "Receipt No", key: "receiptNo", width: 14 },
    { header: "Completion Time", key: "completionTime", width: 20 },
    { header: "Type", key: "type", width: 22 },
    { header: "Direction", key: "direction", width: 10 },
    { header: "Amount (KSh)", key: "amount", width: 14 },
    { header: "Counterparty / Details", key: "counterparty", width: 42 },
    { header: "Linked Receipt", key: "linkedReceipt", width: 14 },
    { header: "Linked Time", key: "linkedTime", width: 20 },
    { header: "Linked Details", key: "linkedDetails", width: 42 },
    { header: "Link Method", key: "linkMethod", width: 20 },
    { header: "Status", key: "status", width: 12 },
  ];

  let currentRow = 1;

  worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "REVERSALS";
  worksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC00000" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow += 2;

  if (rows.length === 0) {
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value =
      "No reversals found in this statement.";
    worksheet.getCell(`A${currentRow}`).font = {
      italic: true,
      color: { argb: "FF666666" },
    };
    return;
  }

  const moneyIn = rows
    .filter((r) => r.direction === "In")
    .reduce((sum, r) => sum + r.amount, 0);
  const moneyOut = rows
    .filter((r) => r.direction === "Out")
    .reduce((sum, r) => sum + r.amount, 0);
  const linkedCount = rows.filter((r) => r.linked).length;

  const summaryLines: [string, string | number][] = [
    ["Total reversals", rows.length],
    ["Linked to original", `${linkedCount} / ${rows.length}`],
    ["Money returned (In)", moneyIn],
    ["Money pulled back (Out)", moneyOut],
    ["Net from reversals", moneyIn - moneyOut],
  ];

  worksheet.getCell(`A${currentRow}`).value = "SUMMARY";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCE4D6" },
  };
  currentRow++;

  summaryLines.forEach(([label, value]) => {
    worksheet.getCell(`A${currentRow}`).value = label;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`B${currentRow}`).value = value;
    if (typeof value === "number") {
      worksheet.getCell(`B${currentRow}`).numFmt = "#,##0.00";
    }
    currentRow++;
  });

  currentRow += 1;

  const headers = [
    "Receipt No",
    "Completion Time",
    "Type",
    "Direction",
    "Amount (KSh)",
    "Counterparty / Details",
    "Linked Receipt",
    "Linked Time",
    "Linked Details",
    "Link Method",
    "Status",
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC7CE" },
    };
    cell.alignment = { horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  currentRow++;

  rows.forEach((row) => {
    const values: (string | number)[] = [
      row.reversal.receiptNo,
      row.reversal.completionTime,
      row.kindLabel,
      row.direction,
      row.amount,
      row.counterparty || normalizeDetails(row.reversal.details),
      row.linked?.receiptNo || "",
      row.linked?.completionTime || "",
      row.linked ? normalizeDetails(row.linked.details) : "",
      row.linkMethod || "",
      row.reversal.transactionStatus,
    ];

    values.forEach((value, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = value;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (index === 4 && typeof value === "number") {
        cell.numFmt = "#,##0.00";
      }
      if (index === 3) {
        cell.font = {
          color: {
            argb: row.direction === "In" ? "FF006100" : "FF9C0006",
          },
        };
      }
    });
    currentRow++;
  });
}
