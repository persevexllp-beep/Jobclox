/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'candidate' | 'company' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  profilePhotoUrl?: string;
  createdAt: string;
}

export interface Company {
  id: string;
  userId: string; // Owner HR User ID
  companyName: string;
  website: string;
  linkedin: string;
  industry: string;
  companyEmail: string;
  contactPerson: string;
  phone: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  documents: { name: string; url?: string; path?: string; mimeType?: string; uploadedAt?: string }[];
  createdAt: string;
}

export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
export type JobStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paused' | 'closed' | 'archived' | 'flagged' | 'suspended';

export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  department: string;
  location: string;
  jobType: JobType;
  workMode?: 'remote' | 'hybrid' | 'onsite';
  experience: string;
  education?: string;
  salary: string;
  benefits?: string;
  equity?: string;
  description: string;
  requirements: string[]; // Master skills/keywords matching array (e.g. ["React", "Node"])
  preferredSkills: string[];
  status: JobStatus;
  deadline?: string;
  openings?: number;
  hiringManager?: string;
  visibility?: 'public' | 'private';
  featured?: boolean;
  sponsored?: boolean;
  priority?: boolean;
  moderationReason?: string;
  viewCount: number;
  createdAt: string;
  updatedAt?: string;
}

export type ApplicationStatus = 
  | 'applied' 
  | 'under_review' 
  | 'shortlisted' 
  | 'forwarded' 
  | 'interviewing' 
  | 'selected' 
  | 'rejected';

export interface Application {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateProfilePhotoUrl?: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  score: number; // 0-100 percentage match
  matchedSkills: string[];
  missingSkills: string[];
  status: ApplicationStatus;
  notes: string; // admin internal review notes
  appliedAt: string;
  interviewDate?: string;
  finalResult?: 'hired' | 'rejected' | 'withdrawn';
  rejectionReason?: string;
}

export interface CandidateProfile {
  id: string;
  userId: string;
  education: string;
  skills: string[]; // parsed current skills
  experience: string; // years or summary
  resumeText: string;
  resumeFileName: string;
  resumeUrl?: string;
  profilePhotoUrl?: string;
  createdAt: string;
}

export interface ResumeEducationItem {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface ResumeExperienceItem {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  summary: string;
}

export interface ResumeProjectItem {
  name: string;
  description: string;
  technologies: string[];
}

export interface ParsedResumeData {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  education: ResumeEducationItem[];
  experience: ResumeExperienceItem[];
  certifications: string[];
  projects: ResumeProjectItem[];
  links: {
    linkedin: string;
    github: string;
    portfolio: string;
  };
}

export interface ResumeConfidence {
  overallConfidence: number;
  fieldConfidence: Record<string, number>;
}

export interface ResumeCareerInsights {
  missingSkills: string[];
  recommendedRoles: string[];
  careerScoreInputs: Record<string, number>;
  internshipReadiness: number;
  placementReadiness: number;
}

export interface ResumeAutofillResult {
  applied: Partial<Pick<CandidateProfile, 'education' | 'experience' | 'skills' | 'resumeText' | 'resumeFileName' | 'resumeUrl'>>;
  suggestions: Partial<Pick<CandidateProfile, 'education' | 'experience' | 'skills'>>;
}

export interface ResumeParserResponse {
  text: string;
  parsed: ParsedResumeData;
  confidence: ResumeConfidence;
  careerInsights: ResumeCareerInsights;
  autofill?: ResumeAutofillResult;
  parser: {
    primaryLayer: 'gemini' | 'pdf-parse' | 'regex';
    layersAttempted: string[];
    warnings: string[];
    errors: string[];
  };
}

export interface AppNotification {
  id: string;
  recipientId: string; // "all_admin" or specific user ID
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
}

export interface EmailAlert {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status: 'delivered' | 'failed' | 'pending';
  triggeredByEvent: string;
  createdAt: string;
}
