// Sends a weapon-detection alert email via Resend (through Lovable connector gateway).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const ALERT_RECIPIENT = 'murtazamajid.123@gmail.com';

interface AlertBody {
  label?: string;
  confidence?: number;
  source?: string;
  imageBase64?: string; // raw base64 (no data: prefix) of snapshot
  timestamp?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

    const body = (await req.json().catch(() => ({}))) as AlertBody;
    const label = (body.label || 'WEAPON').toString().slice(0, 80);
    const confidence = typeof body.confidence === 'number' ? body.confidence : 0;
    const source = (body.source || 'Live camera').toString().slice(0, 80);
    const ts = body.timestamp || new Date().toISOString();
    const confPct = (confidence * 100).toFixed(1);

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0b0b0f; color:#f5f5f7; padding:24px; border-radius:12px; max-width:560px;">
        <div style="display:inline-block; background:#dc2626; color:#fff; padding:6px 12px; border-radius:999px; font-weight:700; letter-spacing:0.5px; font-size:12px;">⚠ THREAT DETECTED</div>
        <h1 style="font-size:22px; margin:16px 0 4px;">Weapon detected: ${label}</h1>
        <p style="margin:0 0 18px; color:#a1a1aa;">Sentinel detected a possible weapon in the live feed.</p>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <tr><td style="padding:6px 0; color:#a1a1aa;">Class</td><td style="padding:6px 0; text-align:right;"><strong>${label}</strong></td></tr>
          <tr><td style="padding:6px 0; color:#a1a1aa;">Confidence</td><td style="padding:6px 0; text-align:right;"><strong>${confPct}%</strong></td></tr>
          <tr><td style="padding:6px 0; color:#a1a1aa;">Source</td><td style="padding:6px 0; text-align:right;">${source}</td></tr>
          <tr><td style="padding:6px 0; color:#a1a1aa;">Time</td><td style="padding:6px 0; text-align:right;">${ts}</td></tr>
        </table>
        <p style="margin-top:20px; color:#a1a1aa; font-size:12px;">Snapshot attached.</p>
      </div>
    `;

    const payload: Record<string, unknown> = {
      from: 'Sentinel Alerts <onboarding@resend.dev>',
      to: [ALERT_RECIPIENT],
      subject: `⚠ Weapon detected: ${label} (${confPct}%)`,
      html,
    };

    if (body.imageBase64 && typeof body.imageBase64 === 'string' && body.imageBase64.length < 5_000_000) {
      payload.attachments = [
        {
          filename: `threat-${Date.now()}.jpg`,
          content: body.imageBase64,
        },
      ];
    }

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend error', res.status, data);
      return new Response(JSON.stringify({ success: false, status: res.status, error: data }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: (data as any)?.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('send-threat-alert failed', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
