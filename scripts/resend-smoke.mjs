const apiKey = process.env.RESEND_API_KEY
const from = process.env.RESEND_FROM_EMAIL
const recipient = process.env.RESEND_TEST_RECIPIENT

if (!apiKey || !from || !recipient) {
  throw new Error('Set RESEND_API_KEY, RESEND_FROM_EMAIL, and RESEND_TEST_RECIPIENT to send the designated smoke-test email.')
}
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RESEND_SMOKE !== 'true') {
  throw new Error('Set ALLOW_RESEND_SMOKE=true to explicitly enable the smoke test in production.')
}

const day = new Date().toISOString().slice(0, 10)
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `submitproof-smoke:${day}:${recipient.toLowerCase()}`,
  },
  body: JSON.stringify({
    from,
    to: [recipient],
    subject: 'SubmitProof Resend delivery check',
    text: 'This is the designated SubmitProof email delivery smoke test. No submission data or student tokens are included.',
    html: '<p>This is the designated SubmitProof email delivery smoke test.</p><p>No submission data or student tokens are included.</p>',
  }),
})
if (!response.ok) {
  const details = await response.text()
  throw new Error(`Resend returned ${response.status}: ${details.slice(0, 500)}`)
}
const result = await response.json()
if (typeof result.id !== 'string' || !result.id) throw new Error('Resend returned no message ID.')
process.stdout.write(`Smoke-test email accepted by Resend for ${recipient} (message ${result.id}).\n`)
