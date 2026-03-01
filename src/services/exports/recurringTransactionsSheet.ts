import { MPesaStatement, Transaction } from "../../types";
import * as ExcelJS from "exceljs";

interface EnrichedTransaction extends Transaction {
  direction: "Sent" | "Received" | "Unknown";
  amount: number;
}

interface RecurringPattern {
  details: string;
  type: "Sent" | "Received" | "Mixed";
  frequency: string;
  occurrences: number;
  avgAmount: number;
  totalAmount: number;
  amountPattern: "Fixed" | "Variable";
  lastTransaction: string;
  nextExpected: string;
  medianIntervalDays: number;
}

export function addRecurringTransactionsSheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  if (statement.transactions.length === 0) return;

  const nonChargeTransactions = statement.transactions.filter(
    (t) => !t.details.toLowerCase().includes("charge")
  );

  const patterns = detectRecurringPatterns(nonChargeTransactions);

  if (patterns.length === 0) return;

  const worksheet = workbook.addWorksheet("Recurring Transactions");

  let currentRow = 1;

  // Title
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "RECURRING TRANSACTIONS";
  worksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E7145" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow += 2;

  // Column headers
  const headers = [
    "Transaction Details",
    "Type",
    "Frequency",
    "Occurrences",
    "Avg Amount (KSh)",
    "Total Amount (KSh)",
    "Amount Pattern",
    "Last Transaction",
    "Next Expected",
    "Median Interval (days)",
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E2F3" },
    };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  currentRow++;

  // Data rows
  patterns.forEach((pattern) => {
    const rowValues: (string | number)[] = [
      pattern.details,
      pattern.type,
      pattern.frequency,
      pattern.occurrences,
      pattern.avgAmount,
      pattern.totalAmount,
      pattern.amountPattern,
      pattern.lastTransaction,
      pattern.nextExpected,
      pattern.medianIntervalDays,
    ];

    rowValues.forEach((value, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      if (colIndex === 4 || colIndex === 5) {
        cell.numFmt = "#,##0.00";
      }

      if (colIndex === 1) {
        const typeColor =
          pattern.type === "Received"
            ? "FF008000"
            : pattern.type === "Sent"
            ? "FFCC0000"
            : "FF888888";
        cell.font = { color: { argb: typeColor }, bold: true };
      }

      if (colIndex === 6) {
        cell.font = {
          color: {
            argb:
              pattern.amountPattern === "Fixed" ? "FF008000" : "FFCC6600",
          },
        };
      }
    });

    currentRow++;
  });

  // Summary footer
  currentRow++;
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "SUMMARY";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 13 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  const totalAmount = patterns.reduce((sum, p) => sum + p.totalAmount, 0);

  worksheet.getCell(`A${currentRow}`).value = "Recurring Patterns Found:";
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  worksheet.getCell(`B${currentRow}`).value = patterns.length;
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value =
    "Total Amount in Recurring Transactions:";
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  worksheet.getCell(
    `B${currentRow}`
  ).value = `KSh ${totalAmount.toLocaleString()}`;
  worksheet.getCell(`B${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE4B5" },
  };
  worksheet.getCell(`B${currentRow}`).font = { bold: true };

  // Column widths
  worksheet.columns = [
    { width: 45 },
    { width: 12 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 20 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 22 },
  ];
}

function enrichTransactions(transactions: Transaction[]): EnrichedTransaction[] {
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.completionTime).getTime() - new Date(b.completionTime).getTime()
  );

  return sorted.map((t, i) => {
    let direction: "Sent" | "Received" | "Unknown" = "Unknown";

    if (i > 0) {
      const balanceDelta = t.balance - sorted[i - 1].balance;
      if (balanceDelta < 0) direction = "Sent";
      else if (balanceDelta > 0) direction = "Received";
    } else {
      // First transaction — no previous balance to compare; use available fields
      if (t.paidIn !== null && t.paidIn > 0) direction = "Received";
      else if (t.withdrawn !== null && t.withdrawn > 0) direction = "Sent";
    }

    // Use the parsed amount fields; fall back to absolute balance delta if needed
    let amount = 0;
    if (direction === "Sent") {
      amount =
        t.withdrawn !== null && t.withdrawn > 0
          ? t.withdrawn
          : i > 0
          ? Math.abs(t.balance - sorted[i - 1].balance)
          : 0;
    } else if (direction === "Received") {
      amount =
        t.paidIn !== null && t.paidIn > 0
          ? t.paidIn
          : i > 0
          ? t.balance - sorted[i - 1].balance
          : 0;
    }

    return { ...t, direction, amount };
  });
}

function detectRecurringPatterns(
  transactions: Transaction[]
): RecurringPattern[] {
  const enriched = enrichTransactions(transactions);

  // Group by details string — the natural key for a recurring transaction type
  const byDetails = new Map<string, EnrichedTransaction[]>();
  enriched.forEach((t) => {
    const key = t.details.trim();
    if (!byDetails.has(key)) byDetails.set(key, []);
    byDetails.get(key)!.push(t);
  });

  const patterns: RecurringPattern[] = [];

  byDetails.forEach((group, detailsKey) => {
    if (group.length < 3) return;

    const sorted = [...group].sort(
      (a, b) =>
        new Date(a.completionTime).getTime() -
        new Date(b.completionTime).getTime()
    );

    // Determine dominant direction across the group
    const sentCount = sorted.filter((t) => t.direction === "Sent").length;
    const receivedCount = sorted.filter(
      (t) => t.direction === "Received"
    ).length;
    const type: "Sent" | "Received" | "Mixed" =
      sentCount === sorted.length
        ? "Sent"
        : receivedCount === sorted.length
        ? "Received"
        : "Mixed";

    // Median interval in days between consecutive occurrences
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diffMs =
        new Date(sorted[i].completionTime).getTime() -
        new Date(sorted[i - 1].completionTime).getTime();
      intervals.push(diffMs / (1000 * 60 * 60 * 24));
    }
    const medianInterval = computeMedian(intervals);
    const frequency = classifyFrequency(medianInterval);

    // Amount consistency via coefficient of variation
    const amounts = sorted.map((t) => t.amount);
    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
    const avgAmount = amounts.length > 0 ? totalAmount / amounts.length : 0;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) /
        amounts.length
    );
    const cv = avgAmount > 0 ? stdDev / avgAmount : 0;
    const amountPattern: "Fixed" | "Variable" = cv < 0.2 ? "Fixed" : "Variable";

    const lastDate = new Date(sorted[sorted.length - 1].completionTime);
    const nextDate = new Date(
      lastDate.getTime() + medianInterval * 24 * 60 * 60 * 1000
    );

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    patterns.push({
      details: detailsKey,
      type,
      frequency,
      occurrences: sorted.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      avgAmount: Math.round(avgAmount * 100) / 100,
      amountPattern,
      lastTransaction: formatDate(lastDate),
      nextExpected: formatDate(nextDate),
      medianIntervalDays: Math.round(medianInterval * 10) / 10,
    });
  });

  patterns.sort((a, b) => b.totalAmount - a.totalAmount);
  return patterns;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classifyFrequency(medianDays: number): string {
  if (medianDays <= 9) return "Weekly";
  if (medianDays <= 20) return "Bi-weekly";
  if (medianDays <= 40) return "Monthly";
  if (medianDays <= 100) return "Quarterly";
  return "Irregular (Repeated)";
}
