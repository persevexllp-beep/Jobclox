import ExcelJS from 'exceljs';
import type { ExternalJobApplication } from '@/src/types';
import { branding } from '@/src/config/branding';

const HEADERS = [
  'Candidate Name', 'Email', 'Phone', 'Skills', 'Experience', 'Resume URL',
  'Job Title', 'Company Name', 'Source', 'Applied Date', 'Status', 'Notes',
] as const;

function neutralizeSpreadsheetFormula(value: unknown): string {
  const text = String(value ?? '').replace(/\u0000/g, '').trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function statusLabel(status: string): string {
  return status.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function toExportRow(lead: ExternalJobApplication): Array<string | Date> {
  return [
    neutralizeSpreadsheetFormula(lead.candidateName),
    neutralizeSpreadsheetFormula(lead.candidateEmail),
    neutralizeSpreadsheetFormula(lead.candidatePhone),
    neutralizeSpreadsheetFormula(lead.skills.join(', ')),
    neutralizeSpreadsheetFormula(lead.experience),
    neutralizeSpreadsheetFormula(lead.resumeUrl),
    neutralizeSpreadsheetFormula(lead.jobTitle),
    neutralizeSpreadsheetFormula(lead.companyName),
    neutralizeSpreadsheetFormula(lead.source),
    new Date(lead.createdAt),
    statusLabel(lead.status),
    neutralizeSpreadsheetFormula(lead.notes),
  ];
}

function csvCell(value: string | Date): string {
  const text = value instanceof Date ? value.toISOString() : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function createExternalLeadCsv(leads: ExternalJobApplication[]): Buffer {
  const rows = [HEADERS.map(csvCell).join(','), ...leads.map((lead) => toExportRow(lead).map(csvCell).join(','))];
  return Buffer.from(`\uFEFF${rows.join('\r\n')}`, 'utf8');
}

export async function createExternalLeadXlsx(leads: ExternalJobApplication[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = branding.productName;
  workbook.created = new Date();
  workbook.modified = new Date();
  const sheet = workbook.addWorksheet('External Leads', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  sheet.columns = [
    { header: HEADERS[0], key: 'candidateName', width: 24 }, { header: HEADERS[1], key: 'email', width: 30 },
    { header: HEADERS[2], key: 'phone', width: 18 }, { header: HEADERS[3], key: 'skills', width: 34 },
    { header: HEADERS[4], key: 'experience', width: 42 }, { header: HEADERS[5], key: 'resumeUrl', width: 42 },
    { header: HEADERS[6], key: 'jobTitle', width: 30 }, { header: HEADERS[7], key: 'companyName', width: 26 },
    { header: HEADERS[8], key: 'source', width: 14 }, { header: HEADERS[9], key: 'appliedDate', width: 21 },
    { header: HEADERS[10], key: 'status', width: 24 }, { header: HEADERS[11], key: 'notes', width: 42 },
  ];
  for (const lead of leads) sheet.addRow(toExportRow(lead));
  const header = sheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.autoFilter = { from: 'A1', to: 'L1' };
  sheet.getColumn(10).numFmt = 'yyyy-mm-dd hh:mm';
  sheet.getColumn(3).numFmt = '@';
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = 34;
    if (rowNumber % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  }
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

export function externalLeadExportFilename(format: 'csv' | 'xlsx'): string {
  return `jobclox-external-leads-${new Date().toISOString().slice(0, 10)}.${format}`;
}
