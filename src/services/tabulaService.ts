import { invoke } from "@tauri-apps/api/core";
import { MPesaStatement, Transaction } from "../types";
import { tempDir, join } from "@tauri-apps/api/path";
import { writeFile, readTextFile, remove } from "@tauri-apps/plugin-fs";
import { FILE_PREFIXES } from "../constants";

export class TabulaService {
  /**
   * Process PDF using Tabula via Rust backend
   */
  static async extractTablesFromPdf(
    file: File,
    password?: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const tempInputName = `${FILE_PREFIXES.TEMP_INPUT}${timestamp}.pdf`;
    const tempOutputName = `${FILE_PREFIXES.TEMP_OUTPUT}${timestamp}.csv`;

    try {
      const tempDirPath = await tempDir();
      const inputPath = await join(tempDirPath, tempInputName);
      const outputPath = await join(tempDirPath, tempOutputName);
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      await writeFile(inputPath, bytes);

      await invoke<string>("extract_pdf_tables", {
        pdfPath: inputPath,
        outputPath: outputPath,
        password: password || null,
      });

      const csvContent = await readTextFile(outputPath);

      try {
        await remove(inputPath);
        await remove(outputPath);
      } catch (e) {
        console.warn("Failed to clean up temp files:", e);
      }
      return csvContent;
    } catch (error: any) {
      const tempDirPath = await tempDir();
      try {
        await remove(await join(tempDirPath, tempInputName));
        await remove(await join(tempDirPath, tempOutputName));
      } catch (error) {
        console.warn(
          "Failed to clean up temp files during error handling:",
          error,
        );
      }
      const message =
        typeof error === "string"
          ? error
          : error?.message || String(error);
      throw new Error(`Tabula extraction failed: ${message}`);
    }
  }

  /** True when a Tabula/backend error indicates the PDF needs a password. */
  static isPasswordError(message: string | undefined): boolean {
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
      lower.includes("password") ||
      lower.includes("encrypted") ||
      lower.includes("decrypt") ||
      lower.includes("protected")
    );
  }

  /**
   * Parse CSV output from Tabula into MPesaStatement
   */
  static parseTabulaCSV(csvContent: string): MPesaStatement {
    const transactions: Transaction[] = [];
    // Tabula often wraps long Details across newlines inside quotes. Splitting
    // on \n alone drops those rows (common for reversals / long paybill names).
    const lines = this.splitCsvRecords(csvContent);

    if (lines.length === 0) {
      return { transactions: [], totalCharges: 0 };
    }

    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      if (
        lowerLine.includes("receipt") &&
        lowerLine.includes("completion") &&
        (lowerLine.includes("details") || lowerLine.includes("transaction"))
      ) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return { transactions: [], totalCharges: 0 };
    }

    const headerLine = lines[headerIndex].toLowerCase();
    const isPaybillStatement =
      headerLine.includes("other party") ||
      headerLine.includes("transaction type");

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];

      const fields = this.parseCSVLine(line);

      if (fields.length < 4) continue;

      if (fields[0]?.toLowerCase().includes("receipt")) continue;

      const normalize = (value: string | undefined) =>
        (value || "").trim().replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");

      const transaction: Transaction = {
        receiptNo: normalize(fields[0]),
        completionTime: normalize(fields[1]),
        details: normalize(fields[2]),
        transactionStatus: normalize(fields[3]) || "Unknown",
        paidIn: this.parseAmount(fields[4]),
        withdrawn: this.parseAmount(fields[5]),
        balance: this.parseAmount(fields[6]) || 0,
        raw: line,
      };

      if (isPaybillStatement && fields.length >= 8) {
        const transactionType = fields[7]?.trim().replace(/\r/g, " ");
        const otherParty = fields[8]?.trim().replace(/\r/g, " ");

        transaction.transactionType = transactionType;
        transaction.otherParty = otherParty;
      }

      if (!transaction.receiptNo && !transaction.completionTime) {
        continue;
      }

      transactions.push(transaction);
    }

    const sortedTransactions = transactions.sort((a, b) => {
      const dateA = new Date(a.completionTime);
      const dateB = new Date(b.completionTime);
      return dateA.getTime() - dateB.getTime();
    });

    return {
      transactions: sortedTransactions,
      totalCharges: this.calculateTotalCharges(sortedTransactions),
    };
  }

  /**
   * Calculate total charges using the same logic as chargesSheet.ts
   */
  static calculateTotalCharges(transactions: Transaction[]): number {
    const chargeTransactions = transactions.filter((transaction) =>
      transaction.details.toLowerCase().includes("charge"),
    );

    return chargeTransactions.reduce((sum, transaction) => {
      return sum + (transaction.withdrawn || transaction.paidIn || 0);
    }, 0);
  }

  /**
   * Split CSV into records without breaking on newlines that sit inside quotes.
   */
  private static splitCsvRecords(csvContent: string): string[] {
    const records: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < csvContent.length; i++) {
      const char = csvContent[i];

      if (char === '"') {
        if (inQuotes && csvContent[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
          current += char;
        }
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && csvContent[i + 1] === "\n") {
          i++;
        }
        if (current.trim()) {
          records.push(current);
        }
        current = "";
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      records.push(current);
    }

    return records;
  }

  private static parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        fields.push(currentField);
        currentField = "";
      } else {
        currentField += char;
      }
    }

    fields.push(currentField);
    return fields;
  }

  private static parseAmount(amountStr: string | undefined): number | null {
    if (!amountStr || amountStr === "-" || amountStr.trim() === "") {
      return null;
    }

    try {
      const cleaned = amountStr.replace(/[^\d.-]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : Math.abs(parsed);
    } catch {
      return null;
    }
  }
}
