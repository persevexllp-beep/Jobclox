import assert from 'node:assert/strict';
import {
  NOTIFICATION_EVENTS,
  emailTemplates,
  summarizeCommunicationEvent,
  type CommunicationEvent,
} from '../services/communicationService';

const requiredEvents = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_REVIEWED',
  'INTERVIEW_SCHEDULED',
  'JOB_APPROVED',
  'JOB_REJECTED',
  'COMPANY_APPROVED',
  'COMPANY_REJECTED',
  'PASSWORD_RESET',
] as const;

for (const eventType of requiredEvents) {
  assert.ok(NOTIFICATION_EVENTS.includes(eventType), `Canonical event missing: ${eventType}`);
}

const candidateScenario: CommunicationEvent = {
  eventType: 'APPLICATION_SUBMITTED',
  notifications: [{
    recipientId: 'candidate-1',
    title: 'Application Submitted',
    message: 'Your application was submitted.',
    type: 'success',
  }],
  emails: [{
    userId: 'candidate-1',
    recipientEmail: 'candidate@example.com',
    recipientName: 'Candidate One',
    subject: 'Application submitted',
    html: emailTemplates.applicationSubmitted('Candidate One', 'Frontend Engineer', 'Persevex', 88),
  }],
};

const recruiterScenario: CommunicationEvent = {
  eventType: 'INTERVIEW_SCHEDULED',
  notifications: [{
    recipientId: 'candidate-1',
    title: 'Interview Scheduled',
    message: 'Interview details are ready.',
    type: 'success',
  }],
  emails: [{
    userId: 'candidate-1',
    recipientEmail: 'candidate@example.com',
    recipientName: 'Candidate One',
    subject: 'Interview scheduled',
    html: emailTemplates.interviewInvitation('Candidate One', 'Frontend Engineer', 'AWS', '2026-06-20T10:00'),
  }],
};

const adminScenario: CommunicationEvent = {
  eventType: 'COMPANY_APPROVED',
  notifications: [{
    recipientId: 'company-owner-1',
    title: 'Company Account Approved',
    message: 'Your company is approved.',
    type: 'success',
  }],
  emails: [{
    userId: 'company-owner-1',
    recipientEmail: 'hr@example.com',
    recipientName: 'Hiring Team',
    subject: 'Company approved',
    html: emailTemplates.companyDecision('Example Inc', true),
  }],
};

for (const scenario of [candidateScenario, recruiterScenario, adminScenario]) {
  const summary = summarizeCommunicationEvent(scenario);
  assert.equal(summary.notificationCount, 1, `${scenario.eventType} should create one notification`);
  assert.equal(summary.emailCount, 1, `${scenario.eventType} should create one email log`);
  assert.equal(summary.hasInvalidEmail, false, `${scenario.eventType} should have a valid recipient email`);
}

const invalidEmailScenario = summarizeCommunicationEvent({
  eventType: 'PASSWORD_RESET',
  emails: [{
    recipientEmail: 'not-an-email',
    recipientName: 'Unknown',
    subject: 'Reset',
    html: emailTemplates.passwordReset('not-an-email'),
  }],
});
assert.equal(invalidEmailScenario.hasInvalidEmail, true, 'Invalid email should be detected before delivery');

console.log('Communication reliability fixture tests passed.');
