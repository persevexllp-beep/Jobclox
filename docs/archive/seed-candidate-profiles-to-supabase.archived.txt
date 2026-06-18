import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { CandidateProfile } from '../src/types';
import { createProfile, getProfileByUserId } from '../services/candidateProfileService';

const DB_FILE = path.join(process.cwd(), 'server_db.json');

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function main() {
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as { candidates: CandidateProfile[] };
  for (const profile of parsed.candidates || []) {
    if (!isUuid(profile.userId)) {
      console.log(`skip legacy userId ${profile.userId} for profile ${profile.id}`);
      continue;
    }

    const existing = await getProfileByUserId(profile.userId);
    if (existing) {
      console.log(`exists user ${profile.userId} -> ${existing.id}`);
      continue;
    }

    const created = await createProfile({
      userId: profile.userId,
      education: profile.education,
      skills: profile.skills,
      experience: profile.experience,
      resumeText: profile.resumeText,
      resumeFileName: profile.resumeFileName,
      createdAt: profile.createdAt,
    });

    console.log(`created user ${profile.userId} -> ${created.id}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
