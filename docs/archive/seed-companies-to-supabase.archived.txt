import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Company } from '../src/types';
import { createCompany, getCompanyByUserId } from '../services/companyService';

const DB_FILE = path.join(process.cwd(), 'server_db.json');

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function main() {
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as { companies: Company[] };
  for (const company of parsed.companies || []) {
    if (!isUuid(company.userId)) {
      console.log(`skip legacy userId ${company.userId} for ${company.companyName}`);
      continue;
    }

    const existing = await getCompanyByUserId(company.userId);
    if (existing) {
      console.log(`exists ${company.companyName} -> ${existing.id}`);
      continue;
    }

    const created = await createCompany({
      userId: company.userId,
      companyName: company.companyName,
      website: company.website,
      linkedin: company.linkedin,
      industry: company.industry,
      companyEmail: company.companyEmail,
      contactPerson: company.contactPerson,
      phone: company.phone,
      verificationStatus: company.verificationStatus,
      documents: company.documents,
      createdAt: company.createdAt,
    });

    console.log(`created ${created.companyName} -> ${created.id}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
