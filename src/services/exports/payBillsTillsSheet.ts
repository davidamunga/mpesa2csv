import { MPesaStatement, Transaction } from "../../types";
import * as ExcelJS from "exceljs";

export type MerchantKind = "paybill" | "till";

export interface ParsedMerchantPayment {
  kind: MerchantKind;
  number: string;
  name: string;
  account: string | null;
  viaFuliza: boolean;
  viaCard: boolean;
  amount: number;
  receiptNo: string;
  completionTime: string;
  transaction: Transaction;
  fee: number;
}

export interface MerchantAggregate {
  kind: MerchantKind;
  number: string;
  name: string;
  total: number;
  count: number;
  fees: number;
  firstTime: string;
  lastTime: string;
  fulizaCount: number;
}

export interface AccountAggregate {
  kind: "paybill";
  number: string;
  name: string;
  account: string;
  total: number;
  count: number;
  firstTime: string;
  lastTime: string;
}

/** Collapse PDF line-breaks so regexes see a single details line. */
export function normalizeDetails(details: string): string {
  return details.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function transactionAmount(transaction: Transaction): number {
  if (transaction.withdrawn != null && transaction.withdrawn !== 0) {
    return Math.abs(transaction.withdrawn);
  }
  if (transaction.paidIn != null && transaction.paidIn !== 0) {
    return Math.abs(transaction.paidIn);
  }
  return 0;
}

function parseCompletionTime(value: string): number {
  const ts = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(ts) ? 0 : ts;
}

function isChargeDetails(details: string): boolean {
  return details.toLowerCase().includes("charge");
}

/**
 * Parse Pay Bill / Merchant (till) payment rows from statement details.
 * Returns null for charges, P2P, and anything else.
 */
export function parseMerchantPayment(
  transaction: Transaction
): Omit<ParsedMerchantPayment, "fee"> | null {
  const details = normalizeDetails(transaction.details);
  if (!details || isChargeDetails(details)) return null;

  const viaFuliza = /fuliza/i.test(details);
  const viaCard = /^Card\s+/i.test(details);

  // Pay Bill Online to 444400 - Nairobi Water… Acc. 5033619
  // Card Pay Bill Online to 903470 - M-PESA GlobalPay Acc. DIGITALOCEAN…
  // Pay Bill to 4031101 - RED GINGER… Acc. 21
  // Pay Bill Fuliza M-Pesa to …
  const paybill = details.match(
    /^(?:Card\s+)?Pay Bill(?: Online| Fuliza M-Pesa)? to (\d+)\s*-\s*(.+?)(?:\s+Acc\.\s*(.+))?$/i
  );
  if (paybill) {
    return {
      kind: "paybill",
      number: paybill[1],
      name: paybill[2].trim(),
      account: paybill[3]?.trim() || null,
      viaFuliza,
      viaCard,
      amount: transactionAmount(transaction),
      receiptNo: transaction.receiptNo,
      completionTime: transaction.completionTime,
      transaction,
    };
  }

  // Merchant Payment Online to 766114 - STEAK AND PANCAKE LTD1
  // Merchant Payment Fuliza M-Pesa Online to 6727015 - Nairobi Java…
  // Merchant Payment to 998536 - CHICKEN INN…
  const till = details.match(
    /^Merchant Payment(?: Online| Fuliza M-Pesa Online)? to (\d+)\s*-\s*(.+)$/i
  );
  if (till) {
    return {
      kind: "till",
      number: till[1],
      name: till[2].trim(),
      account: null,
      viaFuliza,
      viaCard,
      amount: transactionAmount(transaction),
      receiptNo: transaction.receiptNo,
      completionTime: transaction.completionTime,
      transaction,
    };
  }

  return null;
}

function feeForReceipt(
  receiptNo: string,
  byReceipt: Map<string, Transaction[]>
): number {
  const siblings = byReceipt.get(receiptNo) || [];
  return siblings.reduce((sum, t) => {
    if (!isChargeDetails(t.details)) return sum;
    return sum + transactionAmount(t);
  }, 0);
}

export function collectMerchantPayments(
  statement: MPesaStatement
): ParsedMerchantPayment[] {
  const byReceipt = new Map<string, Transaction[]>();
  statement.transactions.forEach((t) => {
    const list = byReceipt.get(t.receiptNo) || [];
    list.push(t);
    byReceipt.set(t.receiptNo, list);
  });

  const payments: ParsedMerchantPayment[] = [];
  for (const transaction of statement.transactions) {
    const parsed = parseMerchantPayment(transaction);
    if (!parsed || parsed.amount <= 0) continue;
    payments.push({
      ...parsed,
      fee: feeForReceipt(transaction.receiptNo, byReceipt),
    });
  }
  return payments;
}

export function aggregateByMerchant(
  payments: ParsedMerchantPayment[]
): MerchantAggregate[] {
  const map = new Map<string, MerchantAggregate>();

  for (const payment of payments) {
    const key = `${payment.kind}:${payment.number}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        kind: payment.kind,
        number: payment.number,
        name: payment.name,
        total: payment.amount,
        count: 1,
        fees: payment.fee,
        firstTime: payment.completionTime,
        lastTime: payment.completionTime,
        fulizaCount: payment.viaFuliza ? 1 : 0,
      });
      continue;
    }

    existing.total += payment.amount;
    existing.count += 1;
    existing.fees += payment.fee;
    if (payment.viaFuliza) existing.fulizaCount += 1;

    // Prefer the most recent non-empty display name
    if (payment.name) existing.name = payment.name;

    if (
      parseCompletionTime(payment.completionTime) <
      parseCompletionTime(existing.firstTime)
    ) {
      existing.firstTime = payment.completionTime;
    }
    if (
      parseCompletionTime(payment.completionTime) >
      parseCompletionTime(existing.lastTime)
    ) {
      existing.lastTime = payment.completionTime;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function aggregateByAccount(
  payments: ParsedMerchantPayment[]
): AccountAggregate[] {
  const map = new Map<string, AccountAggregate>();

  for (const payment of payments) {
    if (payment.kind !== "paybill" || !payment.account) continue;
    const key = `${payment.number}|${payment.account}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        kind: "paybill",
        number: payment.number,
        name: payment.name,
        account: payment.account,
        total: payment.amount,
        count: 1,
        firstTime: payment.completionTime,
        lastTime: payment.completionTime,
      });
      continue;
    }

    existing.total += payment.amount;
    existing.count += 1;
    if (payment.name) existing.name = payment.name;
    if (
      parseCompletionTime(payment.completionTime) <
      parseCompletionTime(existing.firstTime)
    ) {
      existing.firstTime = payment.completionTime;
    }
    if (
      parseCompletionTime(payment.completionTime) >
      parseCompletionTime(existing.lastTime)
    ) {
      existing.lastTime = payment.completionTime;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function styleHeaderRow(
  worksheet: ExcelJS.Worksheet,
  row: number,
  columns: number,
  fillArgb: string
): void {
  for (let col = 1; col <= columns; col++) {
    const cell = worksheet.getCell(row, col);
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillArgb },
    };
    cell.alignment = { horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }
}

function applyRowBorders(
  worksheet: ExcelJS.Worksheet,
  row: number,
  columns: number
): void {
  for (let col = 1; col <= columns; col++) {
    worksheet.getCell(row, col).border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }
}

export function addPayBillsTillsSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  const payments = collectMerchantPayments(statement);
  const byMerchant = aggregateByMerchant(payments);
  const byAccount = aggregateByAccount(payments);

  const worksheet = workbook.addWorksheet("Pay Bills & Tills");

  worksheet.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Number", key: "number", width: 12 },
    { header: "Name", key: "name", width: 36 },
    { header: "Total (KSh)", key: "total", width: 14 },
    { header: "Count", key: "count", width: 10 },
    { header: "Fees (KSh)", key: "fees", width: 12 },
    { header: "First", key: "first", width: 20 },
    { header: "Last", key: "last", width: 20 },
    { header: "Fuliza #", key: "fuliza", width: 10 },
  ];

  let currentRow = 1;

  worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "PAY BILLS & TILLS";
  worksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E75B6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow += 2;

  if (payments.length === 0) {
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value =
      "No pay bill or till payments found in this statement.";
    worksheet.getCell(`A${currentRow}`).font = {
      italic: true,
      color: { argb: "FF666666" },
    };
    return;
  }

  const paybillSpend = payments
    .filter((p) => p.kind === "paybill")
    .reduce((sum, p) => sum + p.amount, 0);
  const tillSpend = payments
    .filter((p) => p.kind === "till")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalFees = payments.reduce((sum, p) => sum + p.fee, 0);
  const distinctPaybills = byMerchant.filter((m) => m.kind === "paybill").length;
  const distinctTills = byMerchant.filter((m) => m.kind === "till").length;

  worksheet.getCell(`A${currentRow}`).value = "SUMMARY";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDDEBF7" },
  };
  currentRow++;

  const summaryLines: [string, string | number][] = [
    ["Pay Bill spend", paybillSpend],
    ["Till / Buy Goods spend", tillSpend],
    ["Combined spend", paybillSpend + tillSpend],
    ["Fees on those payments", totalFees],
    ["Distinct paybills", distinctPaybills],
    ["Distinct tills", distinctTills],
    ["Total payments", payments.length],
  ];

  summaryLines.forEach(([label, value]) => {
    worksheet.getCell(`A${currentRow}`).value = label;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`B${currentRow}`).value = value;
    if (
      typeof value === "number" &&
      (label.toLowerCase().includes("spend") ||
        label.toLowerCase().includes("fees") ||
        label.toLowerCase().includes("combined"))
    ) {
      worksheet.getCell(`B${currentRow}`).numFmt = "#,##0.00";
    }
    currentRow++;
  });

  currentRow += 1;

  // --- By number ---
  worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "BY PAYBILL / TILL";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDDEBF7" },
  };
  currentRow++;

  const merchantHeaders = [
    "Type",
    "Number",
    "Name",
    "Total (KSh)",
    "Count",
    "Fees (KSh)",
    "First",
    "Last",
    "Fuliza #",
  ];
  merchantHeaders.forEach((header, index) => {
    worksheet.getCell(currentRow, index + 1).value = header;
  });
  styleHeaderRow(worksheet, currentRow, merchantHeaders.length, "FFBDD7EE");
  currentRow++;

  byMerchant.forEach((row) => {
    const values: (string | number)[] = [
      row.kind === "paybill" ? "Pay Bill" : "Till",
      row.number,
      row.name,
      row.total,
      row.count,
      row.fees,
      row.firstTime,
      row.lastTime,
      row.fulizaCount,
    ];
    values.forEach((value, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = value;
      if (index === 3 || index === 5) cell.numFmt = "#,##0.00";
    });
    applyRowBorders(worksheet, currentRow, merchantHeaders.length);
    currentRow++;
  });

  if (byAccount.length === 0) return;

  currentRow += 1;

  // --- Paybill accounts ---
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "PAYBILL ACCOUNTS";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2EFDA" },
  };
  currentRow++;

  const accountHeaders = [
    "Paybill",
    "Name",
    "Account",
    "Total (KSh)",
    "Count",
    "First",
    "Last",
  ];
  accountHeaders.forEach((header, index) => {
    worksheet.getCell(currentRow, index + 1).value = header;
  });
  styleHeaderRow(worksheet, currentRow, accountHeaders.length, "FFC6EFCE");
  currentRow++;

  byAccount.forEach((row) => {
    const values: (string | number)[] = [
      row.number,
      row.name,
      row.account,
      row.total,
      row.count,
      row.firstTime,
      row.lastTime,
    ];
    values.forEach((value, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = value;
      if (index === 3) cell.numFmt = "#,##0.00";
    });
    applyRowBorders(worksheet, currentRow, accountHeaders.length);
    currentRow++;
  });
}
