import 'server-only';

import type { Application, ApplicationStatus, CandidateProfile, Company, Job } from '@/src/types';
import { logger } from '@/services/logger';
import { branding } from '@/src/config/branding';

export function computeApplicationMatch(
  targetJob: Job,
  candProfile: CandidateProfile,
  textToParse: string,
): { matchedSkills: string[]; missingSkills: string[]; matchScore: number } {
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  targetJob.requirements.forEach((skill) => {
    const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:\\b|\\s|\\W)${escaped}(?:\\b|\\s|\\W)`, 'gi');

    if (regex.test(textToParse) || candProfile.skills.some((candidateSkill) => candidateSkill.toLowerCase() === skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  let matchScore = 0;
  if (targetJob.requirements.length > 0) {
    matchScore = Math.round((matchedSkills.length / targetJob.requirements.length) * 100);
    if (matchScore > 92) matchScore = 92;
  }

  return { matchedSkills, missingSkills, matchScore };
}

export async function triggerEmailAlert(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  bodyHtml: string,
  triggeredEvent: string,
) {
  const { emitCommunicationEvent } = await import('@/services/communicationService');

  const result = await emitCommunicationEvent({
    eventType: 'APPLICATION_REVIEWED',
    emails: [{ recipientEmail, recipientName, subject, html: bodyHtml }],
    metadata: { legacyTrigger: triggeredEvent },
  });

  logger.info('email', 'legacy email alert emitted', {
    recipientEmail,
    recipientName,
    subject,
    triggeredEvent,
    status: result.emails[0]?.status || 'not_logged',
  });

  return result.emails[0] || null;
}

export function getCandidateStatusNotification(
  application: Application,
  status: ApplicationStatus,
  interviewDate?: string,
): {
  title: string;
  message: string;
  eventType: 'INTERVIEW_SCHEDULED' | 'APPLICATION_ACCEPTED' | 'APPLICATION_REJECTED' | 'APPLICATION_REVIEWED';
  notificationType: 'info' | 'success' | 'warning';
} {
  let title = 'Application Update';
  let message = `Your profile status for ${application.jobTitle} changed to ${status.replace('_', ' ')}.`;

  if (status === 'shortlisted') {
    title = `Profile Shortlisted by ${branding.productName}`;
    message = `Fantastic! The ${branding.productName} team shortlisted your resume for "${application.jobTitle}". It is currently undergoing final quality routing before submission.`;
  } else if (status === 'forwarded') {
    title = 'Profile Forwarded to Corporate HR!';
    message = `Great news! ${branding.productName} recruiters finalized review and forwarded your credentials to the official hiring team at ${application.companyName}. Keep an eye out for scheduling!`;
  } else if (status === 'interviewing') {
    title = 'Interview Scheduled!';
    message = `The hiring manager at ${application.companyName} checked your profile and scheduled an interview. Details: ${interviewDate || 'To be communicated soon'}.`;
  } else if (status === 'selected') {
    title = 'Congratulations! Direct Job Offer!';
    message = `Excellent news! The hiring manager at ${application.companyName} selected you and marked your application as HIRED for "${application.jobTitle}"!`;
  }

  const eventType = status === 'interviewing'
    ? 'INTERVIEW_SCHEDULED'
    : status === 'selected'
      ? 'APPLICATION_ACCEPTED'
      : status === 'rejected'
        ? 'APPLICATION_REJECTED'
        : 'APPLICATION_REVIEWED';

  const notificationType = status === 'rejected'
    ? 'warning'
    : status === 'selected' || status === 'interviewing'
      ? 'success'
      : 'info';

  return { title, message, eventType, notificationType };
}

export function buildForwardedCompanyEmail(application: Application, company: Company): { subject: string; html: string } {
  return {
    subject: `[Candidate Forwarded] ${branding.productName} matched a candidate for your role - ${application.jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #0f172a; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: bold;">${branding.productName.toUpperCase()} PARTNER HUB</h1>
        </div>
        <div style="padding: 24px; color: #1e293b; background-color: #ffffff; line-height: 1.6;">
          <h3 style="margin-top: 0;">Dear ${company.contactPerson || 'Hiring Team'},</h3>
          <p>We are delighted to inform you that our Senior Recruiters have completed their screening process and forwarded a highly qualified matching candidate for your active role:</p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 4px 0; font-weight: 600; color: #64748b; width: 120px;">Position:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #0f172a;">${application.jobTitle}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Candidate:</td>
                <td style="padding: 4px 0; font-weight: bold; color: #0f172a;">${application.candidateName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Match Index Score:</td>
                <td style="padding: 4px 0;"><span style="background-color: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 9999px; font-weight: bold;">${application.score}% Match</span></td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Matched Skills:</td>
                <td style="padding: 4px 0; color: #0f172a; font-family: monospace;">${application.matchedSkills.join(', ')}</td>
              </tr>
            </table>
          </div>

          <p>The candidate's credentials and analyzed resume details are now fully active on your Recruiting Dashboard. You can trigger direct scheduling, record notes, or mark final hiring decisions there.</p>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
          <div style="text-align: center;">
            <span style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 8px;">Triggered dynamically by ${branding.productName} Status Change System</span>
          </div>
        </div>
      </div>
    `,
  };
}

export function buildCandidateStatusEmail(
  application: Application,
  status: ApplicationStatus,
  interviewDate: string | undefined,
  previousStatus: ApplicationStatus,
): { subject: string; html: string; triggeredEvent: string } {
  let emailSubject = `Application Update: ${application.jobTitle}`;
  const emailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background-color: #10b981; color: white; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.025em;">${branding.productName.toUpperCase()} CAREER HUB</h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; text-transform: uppercase; font-family: monospace;">Automated Alert System</p>
      </div>
      <div style="padding: 24px; color: #1e293b; background-color: #ffffff; line-height: 1.6;">
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 600;">Dear ${application.candidateName},</h3>
        <p>Your application status for the position of <strong>${application.jobTitle}</strong> at <strong>${application.companyName}</strong> has been updated to:</p>
        <div style="background-color: #f1f5f9; border-left: 4px solid #10b981; padding: 12px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b; letter-spacing: 0.1em; display: block;">New Workflow Phase</span>
          <span style="font-size: 18px; font-weight: 700; color: #0fa26e; text-transform: capitalize;">${status.replace('_', ' ')}</span>
        </div>

        <div style="margin: 15px 0; font-size: 14px; text-align: left; background: #fafafa; border: 1px solid #eaeaea; padding: 15px; border-radius: 8px;">
          ${
            status === 'shortlisted'
              ? `<p style='margin:0;'>The ${branding.productName} expert team evaluated your credentials against the job parameters and verified your high qualification match score. We have shortlisted your candidacy and prepared submission folders for Corporate HR managers.</p>`
              : status === 'forwarded'
                ? `<p style='margin:0;'>Outstanding news! We completed candidate routing and forwarded your credentials immediately to the selection committee at <strong>${application.companyName}</strong>. Their HR managers can now view your structured index, experience timelines, and resume PDF fields.</p>`
                : status === 'interviewing'
                  ? `<p style='margin:0;'>Get ready! The recruiting team at <strong>${application.companyName}</strong> has approved your resume and scheduled an interview event. Details listed on ${branding.productName}: <em>${interviewDate || 'To be communicated soon'}</em>.</p>`
                  : status === 'selected'
                    ? `<p style='margin:0;'>Congratulations! After strict corporate review, the hiring leaders at <strong>${application.companyName}</strong> selected your profile and offered the role! Please visit the dashboard on ${branding.productName} to verify and check follow-up parameters.</p>`
                    : status === 'rejected'
                      ? "<p style='margin:0;'>Thank you for participating in the screening pipeline. The corporate hiring managers reviewed your match indexes and decided to proceed with other matching candidates at this stage. We kept your resume active in the general pool for immediate lateral placement!</p>"
                      : "<p style='margin:0;'>Your profile is currently under reviewer evaluation for the matching pipeline in our candidate database.</p>"
          }
        </div>

        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Please sign in to ${branding.productName} to view real-time status details.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
        You are receiving this automated career updates pipeline alert because you are registered on ${branding.productName}.<br />
        ${branding.footer}
      </div>
    </div>
  `;

  if (status === 'shortlisted') {
    emailSubject = `[${branding.productName} Careers] Shortlisted Candidate: ${application.jobTitle}`;
  } else if (status === 'forwarded') {
    emailSubject = `[${branding.productName} Careers] Profile Forwarded to HR Team at ${application.companyName}`;
  } else if (status === 'interviewing') {
    emailSubject = `[Interview Alert] ${application.companyName} scheduled interview for ${application.jobTitle}`;
  } else if (status === 'selected') {
    emailSubject = `[OFFER INCOMING] Congratulations! Job Offer from ${application.companyName}`;
  } else if (status === 'rejected') {
    emailSubject = `[Application Status Update] ${application.jobTitle}`;
  }

  return {
    subject: emailSubject,
    html: emailTemplate,
    triggeredEvent: `Status changed from ${previousStatus} to ${status}`,
  };
}
