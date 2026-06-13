import type { AppNotification, EmailAlert } from '../types';

type PreviewMeta = {
  plainText: string;
  summary: string;
  statusLabel: string;
  preview: string;
};

const STATUS_LABELS: Record<string, string> = {
  forwarded: 'Forwarded',
  shortlisted: 'Shortlisted',
  interviewing: 'Interview Scheduled',
  selected: 'Selected',
  rejected: 'Not Selected',
  under_review: 'Under Review',
  applied: 'Applied',
  delivered: 'Delivered',
  pending: 'Pending',
  failed: 'Failed',
};

function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    const textArea = window.document.createElement('textarea');
    textArea.innerHTML = input;
    return textArea.value;
  }
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function htmlToPlainText(input: string): string {
  if (!input) return '';
  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|section|article|li|tr|h1|h2|h3|h4|h5|h6)\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '- ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const withoutTags = withBreaks.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withoutTags)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function deriveStatusLabel(source: string, fallback: string): string {
  const haystack = `${source} ${fallback}`.toLowerCase();
  for (const [key, label] of Object.entries(STATUS_LABELS)) {
    if (haystack.includes(key.replace(/_/g, ' ')) || haystack.includes(key)) {
      return label;
    }
  }
  return fallback;
}

function summarizeText(text: string, maxLength = 180): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No message preview available.';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function formatEmailAlertPreview(alert: EmailAlert): PreviewMeta {
  const plainText = htmlToPlainText(alert.body);
  const statusLabel = deriveStatusLabel(plainText, STATUS_LABELS[alert.status] || alert.status);
  const summary = summarizeText(plainText);
  const preview = summarizeText(plainText, 280);
  return { plainText, summary, statusLabel, preview };
}

export function formatNotificationPreview(notification: AppNotification): PreviewMeta {
  const plainText = htmlToPlainText(notification.message);
  const statusLabel = deriveStatusLabel(plainText, notification.isRead ? 'Read' : 'Unread');
  const summary = summarizeText(plainText, 140);
  const preview = summarizeText(plainText, 220);
  return { plainText, summary, statusLabel, preview };
}

const ALLOWED_TAGS = new Set([
  'a',
  'article',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  return '#';
}

export function sanitizeEmailHtml(input: string): string {
  if (!input || typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return '';
  }

  const parser = new window.DOMParser();
  const document = parser.parseFromString(input, 'text/html');

  const sanitizeNode = (node: Node, outputDocument: Document): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return outputDocument.createTextNode(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = outputDocument.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => {
        const sanitizedChild = sanitizeNode(child, outputDocument);
        if (sanitizedChild) {
          fragment.appendChild(sanitizedChild);
        }
      });
      return fragment;
    }

    const clean = outputDocument.createElement(tagName);
    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href) {
        clean.setAttribute('href', sanitizeHref(href));
        clean.setAttribute('target', '_blank');
        clean.setAttribute('rel', 'noreferrer noopener');
      }
    }

    Array.from(element.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeNode(child, outputDocument);
      if (sanitizedChild) {
        clean.appendChild(sanitizedChild);
      }
    });

    return clean;
  };

  const cleanDocument = parser.parseFromString('<div class="pvx-sanitized-email"></div>', 'text/html');
  const container = cleanDocument.body.firstElementChild as HTMLElement;
  Array.from(document.body.childNodes).forEach((child) => {
    const sanitized = sanitizeNode(child, cleanDocument);
    if (sanitized) {
      container.appendChild(sanitized);
    }
  });

  return container.innerHTML.trim();
}
