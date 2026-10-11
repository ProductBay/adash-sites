import "server-only";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO;
  if (!apiKey || !from || !replyTo) throw new Error("Password reset email is not configured");
  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [to], reply_to: replyTo, subject: "Reset your A’Dash Sites password",
      text: `A’Dash Sites\n\nReset your password\n\nWe received a request to reset the password for your A’Dash Sites account.\n\nUse this link to choose a new password: ${resetUrl}\n\nThis link expires in 60 minutes.\n\nIf you did not request this change, you can safely ignore this email.\n\nTechnology powered by A’Dash Technologies Group\nhttps://adash.technology`,
      html: `<div style="font-family:Arial,sans-serif;color:#19342d;max-width:600px;margin:auto"><p style="color:#b36f28;font-weight:700;letter-spacing:.12em">A’DASH SITES</p><h1>Reset your password</h1><p>We received a request to reset the password for your A’Dash Sites account.</p><p>Use the button below to choose a new password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#15594a;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p><p>This link expires in 60 minutes.</p><p>If you did not request this change, you can safely ignore this email.</p><hr style="border:0;border-top:1px solid #d8e0da;margin:28px 0"><p style="font-size:13px;color:#52665c">Technology powered by A’Dash Technologies Group<br><a href="https://adash.technology">adash.technology</a></p></div>`
    })
  });
  if (!response.ok) throw new Error("Password reset email provider rejected the request");
}
