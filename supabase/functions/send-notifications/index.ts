import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message?: string; details?: { error?: string } };
type ExpoReceipt = { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401, headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { error: authError } = await caller.auth.getUser();
  if (authError) return new Response('Unauthorized', { status: 401, headers: cors });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const receiptCutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: pendingTickets } = await admin.from('push_delivery_tickets').select('ticket_id,push_token').eq('status', 'pending').lte('created_at', receiptCutoff).limit(500);
  if (pendingTickets?.length) {
    const receiptResponse = await fetch('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: pendingTickets.map((ticket) => ticket.ticket_id) }) });
    if (receiptResponse.ok) {
      const payload = await receiptResponse.json() as { data?: Record<string, ExpoReceipt> };
      for (const ticket of pendingTickets) {
        const receipt = payload.data?.[ticket.ticket_id];
        if (!receipt) continue;
        if (receipt.status === 'ok') await admin.from('push_delivery_tickets').update({ status: 'delivered', checked_at: new Date().toISOString() }).eq('ticket_id', ticket.ticket_id);
        else {
          const code = receipt.details?.error ?? 'Unknown';
          await admin.from('push_delivery_tickets').update({ status: 'failed', error_code: code, error_message: receipt.message?.slice(0, 500) ?? null, checked_at: new Date().toISOString() }).eq('ticket_id', ticket.ticket_id);
          if (code === 'DeviceNotRegistered') await admin.from('push_tokens').update({ enabled: false }).eq('token', ticket.push_token);
        }
      }
    }
  }

  const { data: rows, error } = await admin.from('notification_outbox').select('id,recipient_id,title,body,data,attempts').in('status', ['pending', 'failed']).lte('available_at', new Date().toISOString()).order('created_at').limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  if (!rows?.length) return Response.json({ sent: 0, receiptsChecked: pendingTickets?.length ?? 0 }, { headers: cors });
  const recipientIds = [...new Set(rows.map((row: { recipient_id: string }) => row.recipient_id))];
  const { data: tokens } = await admin.from('push_tokens').select('user_id,token').in('user_id', recipientIds).eq('enabled', true);
  const tokenMap = new Map<string, string[]>();
  for (const item of tokens ?? []) tokenMap.set(item.user_id, [...(tokenMap.get(item.user_id) ?? []), item.token]);

  let sent = 0;
  for (const row of rows) {
    const recipientTokens = tokenMap.get(row.recipient_id) ?? [];
    if (!recipientTokens.length) { await admin.from('notification_outbox').update({ status: 'sent', processed_at: new Date().toISOString(), last_error: 'No enabled device token' }).eq('id', row.id); continue; }
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipientTokens.map((to) => ({ to, title: row.title, body: row.body, data: row.data, sound: 'default', priority: 'high' }))) });
      if (!response.ok) throw new Error(`Expo Push returned ${response.status}`);
      const payload = await response.json() as { data?: ExpoTicket[] };
      let accepted = 0;
      for (let index = 0; index < recipientTokens.length; index += 1) {
        const token = recipientTokens[index];
        const ticket = payload.data?.[index];
        if (!token || !ticket) continue;
        if (ticket.status === 'ok') { accepted += 1; await admin.from('push_delivery_tickets').upsert({ ticket_id: ticket.id, outbox_id: row.id, recipient_id: row.recipient_id, push_token: token }); }
        else if (ticket.details?.error === 'DeviceNotRegistered') await admin.from('push_tokens').update({ enabled: false }).eq('token', token);
      }
      if (accepted === 0) throw new Error('Expo rejected every device token');
      await admin.from('notification_outbox').update({ status: 'sent', attempts: row.attempts + 1, processed_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
      sent += 1;
    } catch (failure) {
      const attempts = row.attempts + 1;
      await admin.from('notification_outbox').update({ status: attempts >= 6 ? 'failed' : 'pending', attempts, available_at: new Date(Date.now() + Math.min(3_600_000, 1000 * 2 ** attempts)).toISOString(), last_error: failure instanceof Error ? failure.message.slice(0, 500) : 'Unknown push error' }).eq('id', row.id);
    }
  }
  return Response.json({ sent, receiptsChecked: pendingTickets?.length ?? 0 }, { headers: cors });
});
