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
  documents: { name: string; url?: string }[];
  createdAt: string;
}

export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
export type JobStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'closed';

export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  department: string;
  location: string;
  jobType: JobType;
  experience: string;
  salary: string;
  description: string;
  requirements: string[]; // Master skills/keywords matching array (e.g. ["React", "Node"])
  preferredSkills: string[];
  status: JobStatus;
  deadline?: string;
  viewCount: number;
  createdAt: string;
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
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientId: string; // "all_admin" or specific user ID
  title: string;
  message: string;
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
