import { auth } from '../lib/firebase';

const BACKEND_URL = import.meta.env.DEV ? "" : (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, '');

export async function runAudit(opts: {
  fileBase64?: string;
  mimeType?: string;
  spreadsheetText?: string;
  useGoogleSearch?: boolean;
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();

  const parts: any[] = [];
  if (opts.fileBase64 && opts.mimeType) {
    parts.push({ inlineData: { mimeType: opts.mimeType, data: opts.fileBase64 } });
  }
  if (opts.spreadsheetText) {
    parts.push({ text: `Spreadsheet contents:\n${opts.spreadsheetText}` });
  }
  parts.push({ text: 'Audit this document and return the JSON.' });

  const res = await fetch(`${BACKEND_URL}/api/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      useGoogleSearch: !!opts.useGoogleSearch,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend error ${res.status}`);
  }

  const { text } = await res.json();
  return parseAuditJSON(text);
}

function parseAuditJSON(raw: string) {
  let text = (raw || '').trim();
  // Strip markdown fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // Find the start of the first JSON object
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('AI did not return a JSON object. Try again or use a clearer document.');
  }

  // Walk through and find the matching closing brace, respecting strings
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) {
    throw new Error('AI returned an incomplete JSON object (was likely truncated).');
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e: any) {
    throw new Error(`AI returned invalid JSON: ${e.message}`);
  }
}
