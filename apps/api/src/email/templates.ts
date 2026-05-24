/**
 * Email HTML templates. Kept inline (no external template engine) for portability — minimal,
 * email-client-friendly markup. Inline styles only.
 */

const BASE_STYLE = `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; line-height: 1.5;`;
const BRAND_GREEN = '#008751';

function shell(inner: string, footer?: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;${BASE_STYLE}">
        <tr><td>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
            <span style="display:inline-block;width:6px;height:18px;border-radius:3px;background:${BRAND_GREEN};"></span>
            <span style="font-family:Georgia, serif;font-size:18px;font-weight:600;color:#0f172a;">Naija Bill Tracker</span>
          </div>
          ${inner}
          ${footer ? `<div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;font-size:12px;color:#64748b;">${footer}</div>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function otpEmailHtml(code: string, ttlMinutes: number): string {
  return shell(
    `
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;margin:0 0 12px 0;">Your sign-in code</h1>
      <p style="margin:0 0 16px 0;">Use this code to sign in. It expires in ${ttlMinutes} minutes.</p>
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px 24px;text-align:center;margin:8px 0 20px 0;">${code}</div>
      <p style="margin:0;font-size:14px;color:#475569;">If you didn't request this, you can ignore this email.</p>
    `,
    `You're receiving this because someone (hopefully you) entered this email at naijabilltracker.example.`,
  );
}

export function stageChangeEmailHtml(opts: {
  billNumber: string;
  billTitle: string;
  jurisdictionName: string;
  oldStage: string;
  newStage: string;
  why: string; // "you follow this bill", "you follow the Education topic", etc.
  billUrl: string;
  manageUrl: string;
  notes?: string;
}): string {
  return shell(
    `
      <p style="margin:0 0 4px 0;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${opts.jurisdictionName} · ${opts.billNumber}</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;margin:0 0 16px 0;line-height:1.3;">${opts.billTitle}</h1>
      <p style="margin:0 0 20px 0;">
        Moved to <strong style="color:${BRAND_GREEN};">${opts.newStage}</strong> from ${opts.oldStage}.
      </p>
      ${opts.notes ? `<p style="margin:0 0 20px 0;font-size:14px;color:#475569;border-left:3px solid #e2e8f0;padding-left:12px;">${escapeHtml(opts.notes)}</p>` : ''}
      <p style="margin:0 0 24px 0;">
        <a href="${opts.billUrl}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;">Read the latest</a>
      </p>
      <p style="margin:0;font-size:13px;color:#64748b;">You received this because ${opts.why}.</p>
    `,
    `<a style="color:#64748b;" href="${opts.manageUrl}">Manage your subscriptions</a>`,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
