import { MPesaStatement } from "../../types";
import * as ExcelJS from "exceljs";

interface DayData {
  dayIndex: number;
  dayName: string;
  transactionCount: number;
  moneyInCount: number;
  moneyInTotal: number;
  moneyOutCount: number;
  moneyOutTotal: number;
  netFlow: number;
  percentOfTotal: number;
}

interface WeekPartData {
  part: string;
  days: string;
  transactionCount: number;
  percentOfTotal: number;
  moneyInTotal: number;
  moneyOutTotal: number;
  netFlow: number;
}

/** Monday-first order for display; Date#getDay() uses Sunday = 0. */
const DAY_ORDER = [
  { jsDay: 1, name: "Monday" },
  { jsDay: 2, name: "Tuesday" },
  { jsDay: 3, name: "Wednesday" },
  { jsDay: 4, name: "Thursday" },
  { jsDay: 5, name: "Friday" },
  { jsDay: 6, name: "Saturday" },
  { jsDay: 0, name: "Sunday" },
];

export function addDayOfWeekActivitySheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  if (statement.transactions.length === 0) return;

  const dayData = buildDayData(statement.transactions);
  const weekPartData = buildWeekPartData(dayData, statement.transactions.length);

  const worksheet = workbook.addWorksheet("Day-of-Week Activity");

  let currentRow = 1;

  // Title
  worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "DAY-OF-WEEK ACTIVITY";
  worksheet.getCell(`A${currentRow}`).font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E4057" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow += 2;

  // Section A: Daily Breakdown
  worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "DAILY BREAKDOWN";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  const dayHeaders = [
    "Day",
    "Transactions",
    "% of Total",
    "Money In Count",
    "Money In (KSh)",
    "Money Out Count",
    "Money Out (KSh)",
    "Net Flow (KSh)",
  ];

  dayHeaders.forEach((header, index) => {
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

  const peakDay = dayData.reduce(
    (peak, d) => (d.transactionCount > peak.transactionCount ? d : peak),
    dayData[0]
  );

  dayData.forEach((day) => {
    const isPeak =
      day.dayIndex === peakDay.dayIndex && peakDay.transactionCount > 0;

    const rowValues: (string | number)[] = [
      day.dayName,
      day.transactionCount,
      `${day.percentOfTotal.toFixed(1)}%`,
      day.moneyInCount,
      day.moneyInTotal,
      day.moneyOutCount,
      day.moneyOutTotal,
      day.netFlow,
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

      if (colIndex === 4 || colIndex === 6 || colIndex === 7) {
        cell.numFmt = "#,##0.00";
      }

      if (isPeak) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF2CC" },
        };
        if (colIndex === 0) {
          cell.font = { bold: true, color: { argb: "FF7D6608" } };
        }
      }

      if (colIndex === 7) {
        cell.font = {
          ...(isPeak ? { bold: true } : {}),
          color: { argb: day.netFlow >= 0 ? "FF008000" : "FFCC0000" },
        };
      }
    });

    currentRow++;
  });

  // Section B: Weekday vs Weekend
  currentRow += 2;
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "WEEKDAY VS WEEKEND";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  const partHeaders = [
    "Part of Week",
    "Days",
    "Transactions",
    "% of Total",
    "Money In (KSh)",
    "Money Out (KSh)",
    "Net Flow (KSh)",
  ];

  partHeaders.forEach((header, index) => {
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

  const mostActivePart = weekPartData.reduce(
    (best, p) => (p.transactionCount > best.transactionCount ? p : best),
    weekPartData[0]
  );

  weekPartData.forEach((part) => {
    const isActive =
      part.part === mostActivePart.part && mostActivePart.transactionCount > 0;

    const rowValues: (string | number)[] = [
      part.part,
      part.days,
      part.transactionCount,
      `${part.percentOfTotal.toFixed(1)}%`,
      part.moneyInTotal,
      part.moneyOutTotal,
      part.netFlow,
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

      if (colIndex >= 4 && colIndex <= 6) {
        cell.numFmt = "#,##0.00";
      }

      if (isActive) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF2CC" },
        };
        if (colIndex === 0) {
          cell.font = { bold: true, color: { argb: "FF7D6608" } };
        }
      }

      if (colIndex === 6) {
        cell.font = {
          color: { argb: part.netFlow >= 0 ? "FF008000" : "FFCC0000" },
        };
      }
    });

    currentRow++;
  });

  // Section C: Key Insights
  currentRow += 2;
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "KEY INSIGHTS";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  const peakMoneyInDay = dayData.reduce(
    (peak, d) => (d.moneyInTotal > peak.moneyInTotal ? d : peak),
    dayData[0]
  );
  const peakMoneyOutDay = dayData.reduce(
    (peak, d) => (d.moneyOutTotal > peak.moneyOutTotal ? d : peak),
    dayData[0]
  );
  const quietestDay = dayData.reduce(
    (quiet, d) =>
      d.transactionCount < quiet.transactionCount ? d : quiet,
    dayData[0]
  );

  const insights: [string, string | number][] = [
    ["Peak Day (most transactions):", peakDay.dayName],
    ["Peak Money-In Day:", peakMoneyInDay.dayName],
    ["Peak Money-Out Day:", peakMoneyOutDay.dayName],
    ["Most Active Part of Week:", mostActivePart.part],
    ["Quietest Day:", quietestDay.dayName],
  ];

  insights.forEach(([label, value]) => {
    worksheet.getCell(`A${currentRow}`).value = label;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`B${currentRow}`).value = value;
    currentRow++;
  });

  worksheet.columns = [
    { width: 18 },
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
}

function buildDayData(transactions: MPesaStatement["transactions"]): DayData[] {
  const byJsDay = new Map<number, Omit<DayData, "percentOfTotal">>();

  DAY_ORDER.forEach(({ jsDay, name }) => {
    byJsDay.set(jsDay, {
      dayIndex: jsDay,
      dayName: name,
      transactionCount: 0,
      moneyInCount: 0,
      moneyInTotal: 0,
      moneyOutCount: 0,
      moneyOutTotal: 0,
      netFlow: 0,
    });
  });

  transactions.forEach((t) => {
    const jsDay = new Date(t.completionTime).getDay();
    const bucket = byJsDay.get(jsDay);
    if (!bucket) return;

    bucket.transactionCount++;
    if (t.paidIn !== null && t.paidIn > 0) {
      bucket.moneyInCount++;
      bucket.moneyInTotal += t.paidIn;
    }
    if (t.withdrawn !== null && t.withdrawn > 0) {
      bucket.moneyOutCount++;
      bucket.moneyOutTotal += t.withdrawn;
    }
    bucket.netFlow = bucket.moneyInTotal - bucket.moneyOutTotal;
  });

  const total = transactions.length;

  return DAY_ORDER.map(({ jsDay }) => {
    const day = byJsDay.get(jsDay)!;
    return {
      ...day,
      percentOfTotal: total > 0 ? (day.transactionCount / total) * 100 : 0,
    };
  });
}

function buildWeekPartData(
  dayData: DayData[],
  totalTransactions: number
): WeekPartData[] {
  const parts: {
    part: string;
    days: string;
    dayIndexes: number[];
  }[] = [
    {
      part: "Weekdays",
      days: "Mon – Fri",
      dayIndexes: [1, 2, 3, 4, 5],
    },
    {
      part: "Weekend",
      days: "Sat – Sun",
      dayIndexes: [6, 0],
    },
  ];

  return parts.map(({ part, days, dayIndexes }) => {
    const matching = dayData.filter((d) => dayIndexes.includes(d.dayIndex));
    const transactionCount = matching.reduce(
      (sum, d) => sum + d.transactionCount,
      0
    );
    const moneyInTotal = matching.reduce((sum, d) => sum + d.moneyInTotal, 0);
    const moneyOutTotal = matching.reduce((sum, d) => sum + d.moneyOutTotal, 0);
    const netFlow = moneyInTotal - moneyOutTotal;
    const percentOfTotal =
      totalTransactions > 0 ? (transactionCount / totalTransactions) * 100 : 0;

    return {
      part,
      days,
      transactionCount,
      percentOfTotal,
      moneyInTotal,
      moneyOutTotal,
      netFlow,
    };
  });
}
