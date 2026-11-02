import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (request) => {
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
  const { data: rows, error } = await admin.from('notification_outbox').select('id,recipient_id,title,body,data,attempts').in('status', ['pending', 'failed']).lte('available_at', new Date().toISOString()).order('created_at').limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  if (!rows?.length) return Response.json({ sent: 0 }, { headers: cors });

  const recipientIds = [...new Set(rows.map((row) => row.recipient_id))];
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
      await admin.from('notification_outbox').update({ status: 'sent', attempts: row.attempts + 1, processed_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
      sent += 1;
    } catch (failure) {
      const attempts = row.attempts + 1;
      await admin.from('notification_outbox').update({ status: attempts >= 6 ? 'failed' : 'pending', attempts, available_at: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** attempts)).toISOString(), last_error: failure instanceof Error ? failure.message.slice(0, 500) : 'Unknown push error' }).eq('id', row.id);
    }
  }
  return Response.json({ sent }, { headers: cors });
});
