import "dotenv/config";
import crypto from "crypto";
import { promisify } from "util";
import { createClient } from "@supabase/supabase-js";

const scryptAsync = promisify(crypto.scrypt);
const BASE_URL = "http://127.0.0.1:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Json = Record<string, unknown>;

type TraceEntry = {
  label: string;
  method: string;
  url: string;
  status: number;
  ok: boolean;
  requestBody?: unknown;
  responseBody?: unknown;
};

type SmokeResult = {
  traces: TraceEntry[];
  candidate: Record<string, unknown>;
  recruiter: Record<string, unknown>;
  admin: Record<string, unknown>;
  storage: Record<string, unknown>;
};

const traces: TraceEntry[] = [];

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@persevex-smoke.local`;
}

function authHeaders(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api<T = Json>(label: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // keep raw text
  }
  traces.push({
    label,
    method: options.method || "GET",
    url: `${BASE_URL}${path}`,
    status: response.status,
    ok: response.ok,
    requestBody: options.body ? JSON.parse(String(options.body)) : undefined,
    responseBody: body,
  });
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${typeof body === "object" && body && "error" in body ? String((body as Json).error) : text}`);
  }
  return body as T;
}

function pngDataUrl() {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9lRsAAAAASUVORK5CYII=";
  return `data:image/png;base64,${base64}`;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdfBase64(lines: string[]): string {
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    ...lines.flatMap((line, index) => index === 0
      ? [`(${escapePdfText(line)}) Tj`]
      : ["0 -18 Td", `(${escapePdfText(line)}) Tj`]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8").toString("base64");
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
}

async function ensureAdminUser(email: string, password: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("id,email")
    .eq("email", email)
    .maybeSingle<{ id: string; email: string }>();
  if (lookupError) throw lookupError;

  let userId = existing?.id || crypto.randomUUID();
  if (!existing) {
    const { error } = await supabase.from("users").insert({
      id: userId,
      name: "Smoke Admin",
      email,
      role: "admin",
      status: "active",
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: await hashPassword(password), role: "admin", status: "active" })
    .eq("id", userId);
  if (updateError) throw updateError;
  return userId;
}

async function listStorage(prefixBucket: string, prefix: string) {
  const { data, error } = await supabase.storage.from(prefixBucket).list(prefix, {
    limit: 20,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) {
    throw error;
  }
  return data || [];
}

async function main() {
  const candidateEmail = uniqueEmail("candidate");
  const recruiterEmail = uniqueEmail("recruiter");
  const adminEmail = uniqueEmail("admin");
  const password = "SmokeTest123";

  const candidateRegister = await api<{ user: { id: string }; token: string }>(
    "candidate register",
    "/api/auth/register",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: "Smoke Candidate", email: candidateEmail, password, role: "candidate" }),
    }
  );

  const candidateToken = candidateRegister.token;
  const candidateUserId = candidateRegister.user.id;
  const candidateProfile = await api<{ profile: { id: string } }>(
    "candidate profile get before photo",
    `/api/candidates/${candidateUserId}`,
    { headers: authHeaders(candidateToken) }
  );

  const photoPayload = {
    base64: pngDataUrl(),
    fileName: "smoke-avatar.png",
    mimeType: "image/png",
  };
  const photoUpload = await api<{ profilePhotoUrl: string }>(
    "candidate photo upload",
    "/api/candidates/profile/photo",
    {
      method: "POST",
      headers: authHeaders(candidateToken),
      body: JSON.stringify(photoPayload),
    }
  );

  const candidateAfterPhoto = await api<{ profile: { profilePhotoUrl?: string } }>(
    "candidate profile get after photo",
    `/api/candidates/${candidateUserId}`,
    { headers: authHeaders(candidateToken) }
  );

  const resumeBase64 = createPdfBase64([
    "SMOKE CANDIDATE",
    candidateEmail,
    "Phone: 9999999999",
    "Location: Bengaluru",
    "Skills: React, Node.js, SQL, TypeScript",
    "Education: B.Tech Computer Science",
    "Experience: Internship at Persevex Labs",
  ]);
  const resumeParse = await api<Json>(
    "candidate resume parse",
    "/api/parser/pdf",
    {
      method: "POST",
      headers: authHeaders(candidateToken),
      body: JSON.stringify({ base64: resumeBase64, fileName: "smoke-resume.pdf" }),
    }
  );

  const candidateAfterResume = await api<{ profile: { id: string; resumeUrl?: string; resumeFileName?: string; resumeText?: string } }>(
    "candidate profile get after resume",
    `/api/candidates/${candidateUserId}`,
    { headers: authHeaders(candidateToken) }
  );

  const recruiterRegister = await api<{ user: { id: string }; token: string }>(
    "recruiter register",
    "/api/auth/register",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: "Smoke Recruiter", email: recruiterEmail, password, role: "company" }),
    }
  );
  const recruiterToken = recruiterRegister.token;
  const recruiterCompanyBefore = await api<{ company: { id: string; documents: Array<Record<string, unknown>>; verificationStatus: string } }>(
    "recruiter company get before doc",
    "/api/companies/my",
    { headers: authHeaders(recruiterToken) }
  );

  const companyDocBase64 = createPdfBase64([
    "PERSEVEX SMOKE COMPANY DOCUMENT",
    "Legal Entity Proof",
    recruiterEmail,
  ]);
  const companyDocUpload = await api<{ company: { documents: Array<Record<string, unknown>> } }>(
    "recruiter document upload",
    "/api/companies/documents",
    {
      method: "POST",
      headers: authHeaders(recruiterToken),
      body: JSON.stringify({
        base64: companyDocBase64,
        fileName: "smoke-company-doc.pdf",
        mimeType: "application/pdf",
      }),
    }
  );

  const recruiterCompanyUpdate = await api<{ company: { id: string } }>(
    "recruiter company update",
    "/api/companies/update",
    {
      method: "POST",
      headers: authHeaders(recruiterToken),
      body: JSON.stringify({
        companyName: "Smoke Recruiter Labs",
        website: "https://smoke.example.com",
        linkedin: "https://linkedin.com/company/smoke-recruiter-labs",
        industry: "Technology",
        companyEmail: recruiterEmail,
        contactPerson: "Smoke Recruiter",
        phone: "+1 555-011-2200",
      }),
    }
  );

  const recruiterCompanyAfter = await api<{ company: { id: string; documents: Array<{ name: string; url?: string; path?: string }>; verificationStatus: string } }>(
    "recruiter company get after doc",
    "/api/companies/my",
    { headers: authHeaders(recruiterToken) }
  );

  await ensureAdminUser(adminEmail, password);
  const adminLogin = await api<{ user: { id: string }; token: string }>(
    "admin login",
    "/api/auth/login",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email: adminEmail, password }),
    }
  );
  const adminToken = adminLogin.token;

  const adminCompanies = await api<{ companies: Array<{ id: string; userId: string; documents: Array<{ url?: string }> }> }>(
    "admin companies list",
    "/api/companies",
    { headers: authHeaders(adminToken) }
  );

  const targetCompany = adminCompanies.companies.find((company) => company.userId === recruiterRegister.user.id);
  if (!targetCompany) {
    throw new Error("Admin could not see recruiter company");
  }
  const latestDocumentUrl = targetCompany.documents[targetCompany.documents.length - 1]?.url;
  if (!latestDocumentUrl) {
    throw new Error("Admin could not resolve company document URL");
  }
  const signedDocumentFetch = await fetch(latestDocumentUrl);

  const adminApproveCompany = await api<Json>(
    "admin approve company",
    `/api/companies/${targetCompany.id}/status`,
    {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: "approved" }),
    }
  );

  const recruiterPostJob = await api<{ job: { id: string; status: string } }>(
    "recruiter post job",
    "/api/jobs/create",
    {
      method: "POST",
      headers: authHeaders(recruiterToken),
      body: JSON.stringify({
        title: "Smoke Frontend Engineer",
        department: "Engineering",
        location: "Remote",
        jobType: "Full-time",
        experience: "0-2 years",
        salary: "$12 - $18 / hr",
        description: "Build React interfaces and APIs.",
        requirements: ["React", "Node.js"],
        preferredSkills: ["TypeScript", "SQL"],
        deadline: "2026-12-31",
      }),
    }
  );

  const adminApproveJob = await api<Json>(
    "admin approve job",
    `/api/jobs/${recruiterPostJob.job.id}/status`,
    {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({ status: "approved" }),
    }
  );

  const jobsAfterApproval = await api<{ jobs: Array<{ id: string; companyId: string; status: string }> }>(
    "candidate jobs list",
    "/api/jobs",
    { headers: authHeaders(candidateToken) }
  );
  const targetJob = jobsAfterApproval.jobs.find((job) => job.id === recruiterPostJob.job.id);
  if (!targetJob) {
    throw new Error("Candidate could not see approved recruiter job");
  }

  const candidateApply = await api<Json>(
    "candidate apply job",
    "/api/applications/apply",
    {
      method: "POST",
      headers: authHeaders(candidateToken),
      body: JSON.stringify({
        jobId: targetJob.id,
        uploadedResumeText: String((candidateAfterResume.profile.resumeText || "")),
        uploadedResumeName: String((candidateAfterResume.profile.resumeFileName || "smoke-resume.pdf")),
      }),
    }
  );

  const recruiterApplications = await api<{ applications: Array<{ jobId: string; candidateEmail: string }> }>(
    "recruiter applications list",
    "/api/applications",
    { headers: authHeaders(recruiterToken) }
  );

  const photoObjects = await listStorage("avatars", `${candidateUserId}/${candidateProfile.profile.id}`);
  const resumeReference = String(candidateAfterResume.profile.resumeUrl || "");
  const resumeObjects = await listStorage("resumes", `${candidateUserId}/${candidateProfile.profile.id}`);
  const companyObjects = await listStorage("company-documents", `${recruiterRegister.user.id}/${recruiterCompanyBefore.company.id}`);

  const result: SmokeResult = {
    traces,
    candidate: {
      userId: candidateUserId,
      profileId: candidateProfile.profile.id,
      photoEndpoint: "/api/candidates/profile/photo",
      photoMethod: "POST",
      photoRequestPayload: { fileName: photoPayload.fileName, mimeType: photoPayload.mimeType, hasBase64: true },
      photoResponseUrl: photoUpload.profilePhotoUrl,
      photoVisibleInProfile: candidateAfterPhoto.profile.profilePhotoUrl,
      resumeFileName: candidateAfterResume.profile.resumeFileName,
      resumeReference,
      resumeParsePrimaryLayer: (resumeParse.parser as Json)?.primaryLayer,
      applicationSubmitted: candidateApply,
    },
    recruiter: {
      userId: recruiterRegister.user.id,
      companyId: recruiterCompanyBefore.company.id,
      verificationStatusBefore: recruiterCompanyBefore.company.verificationStatus,
      verificationStatusAfterUpload: recruiterCompanyAfter.company.verificationStatus,
      documentMetadata: recruiterCompanyAfter.company.documents,
      postedJobId: recruiterPostJob.job.id,
      postedJobStatus: recruiterPostJob.job.status,
      applicationsVisible: recruiterApplications.applications.filter((app) => app.jobId === recruiterPostJob.job.id),
    },
    admin: {
      userId: adminLogin.user.id,
      companySeen: Boolean(targetCompany),
      documentUrl: latestDocumentUrl,
      documentFetchStatus: signedDocumentFetch.status,
      companyApproved: adminApproveCompany,
      jobApproved: adminApproveJob,
    },
    storage: {
      buckets: ["avatars", "resumes", "company-documents"],
      photoBucket: "avatars",
      photoPathPrefix: `${candidateUserId}/${candidateProfile.profile.id}`,
      photoObjects,
      resumeBucket: "resumes",
      resumeObjects,
      companyDocumentBucket: "company-documents",
      companyPathPrefix: `${recruiterRegister.user.id}/${recruiterCompanyBefore.company.id}`,
      companyObjects,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error), traces }, null, 2));
  process.exit(1);
});
