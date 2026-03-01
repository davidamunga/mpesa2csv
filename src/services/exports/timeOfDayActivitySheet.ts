import { MPesaStatement } from "../../types";
import * as ExcelJS from "exceljs";

interface HourlyData {
  hour: number;
  label: string;
  transactionCount: number;
  moneyInCount: number;
  moneyInTotal: number;
  moneyOutCount: number;
  moneyOutTotal: number;
  netFlow: number;
}

interface PeriodData {
  period: string;
  hours: string;
  transactionCount: number;
  percentOfTotal: number;
  moneyInTotal: number;
  moneyOutTotal: number;
  netFlow: number;
}

export function addTimeOfDayActivitySheet(
  workbook: ExcelJS.Workbook,
  statement: MPesaStatement
): void {
  if (statement.transactions.length === 0) return;

  const hourlyData = buildHourlyData(statement.transactions);
  const periodData = buildPeriodData(hourlyData, statement.transactions.length);

  const worksheet = workbook.addWorksheet("Time-of-Day Activity");

  let currentRow = 1;

  // Title
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "TIME-OF-DAY ACTIVITY";
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

  // Section A: Hourly Breakdown
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "HOURLY BREAKDOWN";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  const hourlyHeaders = [
    "Hour",
    "Time Slot",
    "Transactions",
    "Money In Count",
    "Money In (KSh)",
    "Money Out Count",
    "Money Out (KSh)",
    "Net Flow (KSh)",
  ];

  hourlyHeaders.forEach((header, index) => {
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

  const peakHour = hourlyData.reduce(
    (peak, h) => (h.transactionCount > peak.transactionCount ? h : peak),
    hourlyData[0]
  );

  hourlyData.forEach((hourData) => {
    const isPeak = hourData.hour === peakHour.hour && peakHour.transactionCount > 0;

    const rowValues: (string | number)[] = [
      hourData.hour,
      hourData.label,
      hourData.transactionCount,
      hourData.moneyInCount,
      hourData.moneyInTotal,
      hourData.moneyOutCount,
      hourData.moneyOutTotal,
      hourData.netFlow,
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

      // Format currency columns
      if (colIndex === 4 || colIndex === 6 || colIndex === 7) {
        cell.numFmt = "#,##0.00";
      }

      // Highlight the peak hour row
      if (isPeak) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFF2CC" },
        };
        if (colIndex === 2) {
          cell.font = { bold: true, color: { argb: "FF7D6608" } };
        }
      }

      // Color code net flow
      if (colIndex === 7) {
        cell.font = {
          ...(isPeak && colIndex === 7 ? { bold: true } : {}),
          color: { argb: hourData.netFlow >= 0 ? "FF008000" : "FFCC0000" },
        };
      }
    });

    currentRow++;
  });

  // Section B: Period Summary
  currentRow += 2;
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "PERIOD SUMMARY";
  worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  currentRow++;

  const periodHeaders = [
    "Period",
    "Hours",
    "Transactions",
    "% of Total",
    "Money In (KSh)",
    "Money Out (KSh)",
    "Net Flow (KSh)",
  ];

  periodHeaders.forEach((header, index) => {
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

  const mostActivePeriod = periodData.reduce(
    (best, p) => (p.transactionCount > best.transactionCount ? p : best),
    periodData[0]
  );

  periodData.forEach((period) => {
    const isActive =
      period.period === mostActivePeriod.period &&
      mostActivePeriod.transactionCount > 0;

    const rowValues: (string | number)[] = [
      period.period,
      period.hours,
      period.transactionCount,
      `${period.percentOfTotal.toFixed(1)}%`,
      period.moneyInTotal,
      period.moneyOutTotal,
      period.netFlow,
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

      // Color code net flow
      if (colIndex === 6) {
        cell.font = {
          ...(isActive && (colIndex as number) === 0 ? { bold: true } : {}),
          color: { argb: period.netFlow >= 0 ? "FF008000" : "FFCC0000" },
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

  const peakMoneyInHour = hourlyData.reduce(
    (peak, h) => (h.moneyInTotal > peak.moneyInTotal ? h : peak),
    hourlyData[0]
  );
  const peakMoneyOutHour = hourlyData.reduce(
    (peak, h) => (h.moneyOutTotal > peak.moneyOutTotal ? h : peak),
    hourlyData[0]
  );
  const quietestHour = hourlyData.reduce(
    (quiet, h) => (h.transactionCount < quiet.transactionCount ? h : quiet),
    hourlyData[0]
  );

  const insights: [string, string | number][] = [
    ["Peak Hour (most transactions):", peakHour.label],
    ["Peak Money-In Hour:", peakMoneyInHour.label],
    ["Peak Money-Out Hour:", peakMoneyOutHour.label],
    ["Most Active Period:", mostActivePeriod.period],
    ["Quietest Hour:", quietestHour.label],
  ];

  insights.forEach(([label, value]) => {
    worksheet.getCell(`A${currentRow}`).value = label;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`B${currentRow}`).value = value;
    currentRow++;
  });

  // Column widths
  worksheet.columns = [
    { width: 10 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
}

function buildHourlyData(transactions: MPesaStatement["transactions"]): HourlyData[] {
  const hours: HourlyData[] = Array.from({ length: 24 }, (_, h) => {
    const startHour = h % 12 === 0 ? 12 : h % 12;
    const endH = h + 1;
    const endHour = endH % 12 === 0 ? 12 : endH % 12;
    const startPeriod = h < 12 ? "AM" : "PM";
    const endPeriod = endH <= 12 ? (endH < 12 ? "AM" : "PM") : "PM";
    const label = `${startHour}:00 ${startPeriod} – ${endHour}:00 ${endPeriod}`;

    return {
      hour: h,
      label,
      transactionCount: 0,
      moneyInCount: 0,
      moneyInTotal: 0,
      moneyOutCount: 0,
      moneyOutTotal: 0,
      netFlow: 0,
    };
  });

  transactions.forEach((t) => {
    const hour = new Date(t.completionTime).getHours();
    const bucket = hours[hour];
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

  return hours;
}

function buildPeriodData(
  hourlyData: HourlyData[],
  totalTransactions: number
): PeriodData[] {
  const periods: { period: string; hours: string; hourRange: [number, number] }[] = [
    { period: "Night", hours: "12 AM – 6 AM", hourRange: [0, 5] },
    { period: "Morning", hours: "6 AM – 12 PM", hourRange: [6, 11] },
    { period: "Afternoon", hours: "12 PM – 6 PM", hourRange: [12, 17] },
    { period: "Evening", hours: "6 PM – 12 AM", hourRange: [18, 23] },
  ];

  return periods.map(({ period, hours, hourRange }) => {
    const periodHours = hourlyData.filter(
      (h) => h.hour >= hourRange[0] && h.hour <= hourRange[1]
    );
    const transactionCount = periodHours.reduce(
      (sum, h) => sum + h.transactionCount,
      0
    );
    const moneyInTotal = periodHours.reduce(
      (sum, h) => sum + h.moneyInTotal,
      0
    );
    const moneyOutTotal = periodHours.reduce(
      (sum, h) => sum + h.moneyOutTotal,
      0
    );
    const netFlow = moneyInTotal - moneyOutTotal;
    const percentOfTotal =
      totalTransactions > 0 ? (transactionCount / totalTransactions) * 100 : 0;

    return {
      period,
      hours,
      transactionCount,
      percentOfTotal,
      moneyInTotal,
      moneyOutTotal,
      netFlow,
    };
  });
}
