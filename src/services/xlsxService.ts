import { MPesaStatement, ExportOptions } from "../types";
import * as ExcelJS from "exceljs";
import {
  addChargesSheet,
  addFinancialSummarySheet,
  addMonthlyWeeklyBreakdownSheet,
  addDailyBalanceTrackerSheet,
  addTransactionAmountDistributionSheet,
  addTopContactsSheet,
  addMoneyInSheet,
  addMoneyOutSheet,
  addRecurringTransactionsSheet,
  addTimeOfDayActivitySheet,
} from "./exports";
import { applyTransactionFilters } from "./transactionFilters";
import { formatDate } from "../utils/dateFormatter";
import { APP_METADATA } from "../constants";

export class XlsxService {
  static async convertStatementToXlsx(
    statement: MPesaStatement,
    options?: ExportOptions
  ): Promise<ArrayBuffer> {
    // Apply filters to the statement for the main transactions sheet
    const filteredStatement = applyTransactionFilters(statement, options);

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Add metadata
    workbook.creator = APP_METADATA.CREATOR;
    workbook.lastModifiedBy = APP_METADATA.CREATOR;
    workbook.created = new Date();
    workbook.modified = new Date();

    // Create worksheet
    const worksheet = workbook.addWorksheet("M-Pesa Transactions");

    // Check if this is a paybill statement (has transactionType or otherParty)
    const isPaybillStatement = filteredStatement.transactions.some(
      (t) => t.transactionType !== undefined || t.otherParty !== undefined
    );

    // Define columns with headers and widths
    const columns: any[] = [
      { header: "Receipt No", key: "receiptNo", width: 12 },
      { header: "Completion Time", key: "completionTime", width: 20 },
      { header: "Details", key: "details", width: 40 },
      { header: "Transaction Status", key: "transactionStatus", width: 18 },
      { header: "Paid In", key: "paidIn", width: 12 },
      { header: "Withdrawn", key: "withdrawn", width: 12 },
      { header: "Balance", key: "balance", width: 12 },
    ];

    // Add paybill-specific columns if needed
    if (isPaybillStatement) {
      columns.push(
        { header: "Transaction Type", key: "transactionType", width: 18 },
        { header: "Other Party", key: "otherParty", width: 30 }
      );
    }

    worksheet.columns = columns;

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    headerRow.alignment = { horizontal: "center" };

    // Add filtered and sorted transaction data
    filteredStatement.transactions.forEach((transaction) => {
      const rowData: any = {
        receiptNo: transaction.receiptNo,
        completionTime: formatDate(
          transaction.completionTime,
          options?.dateFormat
        ),
        details: transaction.details,
        transactionStatus: transaction.transactionStatus,
        paidIn: transaction.paidIn !== null ? transaction.paidIn : "",
        withdrawn: transaction.withdrawn !== null ? transaction.withdrawn : "",
        balance: transaction.balance,
      };

      // Add paybill-specific fields if present
      if (isPaybillStatement) {
        rowData.transactionType = transaction.transactionType || "";
        rowData.otherParty = transaction.otherParty || "";
      }

      worksheet.addRow(rowData);
    });

    const dataRange = worksheet.getRows(1, worksheet.rowCount);
    if (dataRange) {
      dataRange.forEach((row) => {
        if (row) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        }
      });
    }

    // Add Charges/Fees sheet if requested
    if (options?.includeChargesSheet) {
      addChargesSheet(workbook, statement);
    }

    // Add Financial Summary sheet if requested
    if (options?.includeSummarySheet) {
      addFinancialSummarySheet(workbook, statement);
    }

    // Add Monthly/Weekly Breakdown sheet if requested
    if (options?.includeBreakdownSheet) {
      addMonthlyWeeklyBreakdownSheet(workbook, statement);
    }

    // Add Daily Balance Tracker sheet if requested
    if (options?.includeDailyBalanceSheet) {
      addDailyBalanceTrackerSheet(workbook, statement);
    }

    // Add Transaction Amount Distribution sheet if requested
    if (options?.includeAmountDistributionSheet) {
      addTransactionAmountDistributionSheet(workbook, statement);
    }

    // Add Top Contacts sheet if requested
    if (options?.includeTopContactsSheet) {
      addTopContactsSheet(workbook, statement);
    }

    // Add Money In sheet if requested
    if (options?.includeMoneyInSheet) {
      addMoneyInSheet(workbook, statement);
    }

    // Add Money Out sheet if requested
    if (options?.includeMoneyOutSheet) {
      addMoneyOutSheet(workbook, statement);
    }

    // Add Recurring Transactions sheet if requested
    if (options?.includeRecurringTransactionsSheet) {
      addRecurringTransactionsSheet(workbook, statement);
    }

    // Add Time-of-Day Activity sheet if requested
    if (options?.includeTimeOfDaySheet) {
      addTimeOfDayActivitySheet(workbook, statement);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as ArrayBuffer;
  }

  static async createDownloadLink(
    statement: MPesaStatement,
    options?: ExportOptions
  ): Promise<string> {
    const arrayBuffer = await this.convertStatementToXlsx(statement, options);
    const blob = new Blob([arrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return URL.createObjectURL(blob);
  }

  static getFileName(statement: MPesaStatement, timestamp?: string): string {
    const baseFileName = statement.fileName
      ? statement.fileName.replace(/\.[^/.]+$/, "") // Remove extension
      : "mpesa-statement";

    const timeStamp =
      timestamp || new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${baseFileName}_${timeStamp}.xlsx`;
  }
}
