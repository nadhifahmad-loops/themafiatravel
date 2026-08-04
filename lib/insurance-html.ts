import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['a', 'b', 'strong', 'em', 'i', 'u', 'p', 'br', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'colspan',
  'rowspan',
  'width',
  'border',
  'cellpadding',
  'cellspacing',
  'class',
];

export function sanitizeInsuranceHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
