import { MPesaStatement, ExportFormat, ExportOptions } from "../types";
import { CsvService } from "./csvService";
import { JsonService } from "./jsonService";
import { OfxService } from "./ofxService";
import { QifService } from "./qifService";
// XlsxService is intentionally NOT statically imported here.
// ExcelJS (~700 kB) is lazy-loaded only when the user actually exports to XLSX.

export class ExportService {
  static async createDownloadLink(
    statement: MPesaStatement,
    format: ExportFormat,
    options?: ExportOptions
  ): Promise<string> {
    switch (format) {
      case ExportFormat.CSV:
        return CsvService.createDownloadLink(statement, options);
      case ExportFormat.XLSX: {
        const { XlsxService } = await import("./xlsxService");
        return await XlsxService.createDownloadLink(statement, options);
      }
      case ExportFormat.JSON:
        return JsonService.createDownloadLink(statement, options);
      case ExportFormat.OFX:
      case ExportFormat.QFX:
        return OfxService.createDownloadLink(statement, options);
      case ExportFormat.QIF:
        return QifService.createDownloadLink(statement, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getFileName(
    statement: MPesaStatement,
    format: ExportFormat,
    timestamp?: string
  ): string {
    // Inlined so ExportService.getFileName() never pulls in XlsxService/ExcelJS.
    const base = statement.fileName
      ? statement.fileName.replace(/\.[^/.]+$/, "")
      : "mpesa-statement";
    const ts =
      timestamp ||
      new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return `${base}_${ts}.${ExportService.getFileExtension(format)}`;
  }

  static getFileExtension(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.CSV:
        return "csv";
      case ExportFormat.XLSX:
        return "xlsx";
      case ExportFormat.JSON:
        return "json";
      case ExportFormat.OFX:
        return "ofx";
      case ExportFormat.QFX:
        return "qfx";
      case ExportFormat.QIF:
        return "qif";
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getFormatDisplayName(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.CSV:
        return "CSV";
      case ExportFormat.XLSX:
        return "Excel";
      case ExportFormat.JSON:
        return "JSON";
      case ExportFormat.OFX:
        return "OFX (Experimental)";
      case ExportFormat.QFX:
        return "QFX (Experimental)";
      case ExportFormat.QIF:
        return "QIF (Experimental)";
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getAllFormats(): ExportFormat[] {
    return [
      ExportFormat.CSV,
      ExportFormat.XLSX,
      ExportFormat.JSON,
      ExportFormat.OFX,
      ExportFormat.QFX,
      ExportFormat.QIF,
    ];
  }

  static async getFileBuffer(
    statement: MPesaStatement,
    format: ExportFormat,
    options?: ExportOptions
  ): Promise<ArrayBuffer> {
    switch (format) {
      case ExportFormat.CSV: {
        const csvContent = CsvService.convertStatementToCsv(statement, options);
        const BOM = "\uFEFF";
        return new TextEncoder().encode(BOM + csvContent).buffer;
      }
      case ExportFormat.XLSX: {
        // Dynamic import keeps ExcelJS out of the initial bundle.
        const { XlsxService } = await import("./xlsxService");
        return await XlsxService.convertStatementToXlsx(statement, options);
      }
      case ExportFormat.JSON: {
        const jsonContent = JsonService.convertStatementToJson(statement, options);
        return new TextEncoder().encode(jsonContent).buffer;
      }
      case ExportFormat.OFX:
      case ExportFormat.QFX: {
        const ofxContent = OfxService.convertStatementToOfx(statement, options);
        return new TextEncoder().encode(ofxContent).buffer;
      }
      case ExportFormat.QIF: {
        const qifContent = QifService.convertStatementToQif(statement, options);
        return new TextEncoder().encode(qifContent).buffer;
      }
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
