import type { CameraCapturedPicture } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

export type Friend = { id: string; username: string; display_name: string; avatar_path: string | null; username_completed?: boolean };
export type IncomingRequest = Friend & { request_id: string; sender_id: string; created_at: string };
export type BlockedUser = Friend & { blocked_at: string };
export type FriendInvite = Friend & { sender_id: string; expires_at: string };
export type Moment = {
  id: string;
  status: 'pending_upload' | 'waiting_for_friend' | 'reply_uploading' | 'completed' | 'expired' | 'cancelled' | 'failed';
  initiator_id: string;
  responder_id: string;
  other_display_name: string;
  side_one_path: string | null;
  side_two_path: string | null;
  side_one_url?: string;
  side_two_url?: string;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
  layout: MomentLayout;
  visibility: 'private' | 'public';
  public_caption: string | null;
  published_at: string | null;
  approved_by_me: boolean;
  approved_by_other: boolean;
};
export type MomentLayout = 'left' | 'right' | 'top' | 'bottom';
export type PublicMoment = {
  id: string; initiator_id: string; responder_id: string; initiator_name: string; responder_name: string;
  side_one_path: string; side_two_path: string; side_one_url?: string; side_two_url?: string;
  layout: MomentLayout; caption: string | null; published_at: string; like_count: number; liked_by_me: boolean; rank_score: number;
};
export type PreparedPhoto = { uri: string; width: number; height: number; bytes: ArrayBuffer; byteLength: number };
export type AppNotification = {
  id: string;
  event_type: 'friend_request' | 'friend_accepted' | 'moment_received' | 'moment_completed' | 'reaction' | 'public_approval_requested' | 'moment_published';
  entity_id: string | null;
  title: string;
  body: string;
  data: { url?: string; momentId?: string } | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar_path: string | null;
  read_at: string | null;
  created_at: string;
};

const MAX_PHOTO_EDGE = 1536;
const JPEG_QUALITY = 0.72;

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function kickNotificationWorker() { void client().functions.invoke('send-notifications').catch(() => undefined); }
export function wakeNotificationWorker() { kickNotificationWorker(); }

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const withTimeout = async <T>(operation: PromiseLike<T>, milliseconds = 12_000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Network request timed out.')), milliseconds); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) { lastError = error; if (attempt < attempts - 1) await delay((250 * (2 ** attempt)) + Math.random() * 180); }
  }
  throw lastError;
}

export async function preparePhoto(photo: CameraCapturedPicture): Promise<PreparedPhoto> {
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(photo.width, photo.height));
  const width = Math.max(1, Math.round(photo.width * scale));
  const height = Math.max(1, Math.round(photo.height * scale));
  const context = ImageManipulator.manipulate(photo.uri);
  if (scale < 1) context.resize({ width, height });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  const response = await fetch(result.uri);
  if (!response.ok) throw new Error('Could not prepare the captured photo.');
  const bytes = await response.arrayBuffer();
  return { uri: result.uri, width: result.width, height: result.height, bytes, byteLength: bytes.byteLength };
}

export async function listFriends() {
  const { data, error } = await client().rpc('list_friends');
  if (error) throw error;
  return (data ?? []) as Friend[];
}

export async function getMyProfile() {
  const { data, error } = await client().from('profiles').select('id, username, display_name, avatar_path, username_completed').single();
  if (error) throw error;
  return data as Friend;
}

export async function setProfileIdentity(username: string, displayName: string) {
  const { data, error } = await client().rpc('set_profile_identity', {
    requested_username: username,
    requested_display_name: displayName,
  });
  if (error) throw error;
  return (data?.[0] ?? null) as Friend | null;
}

export async function searchPeople(query: string) {
  const { data, error } = await client().rpc('search_profiles', { query, result_limit: 20 });
  if (error) throw error;
  return (data ?? []) as Friend[];
}

export async function listIncomingRequests() {
  const { data, error } = await client().rpc('list_incoming_friend_requests');
  if (error) throw error;
  return (data ?? []) as IncomingRequest[];
}

export async function sendFriendRequest(targetId: string) {
  const { error } = await client().rpc('send_friend_request', { target_id: targetId });
  if (error) throw error;
  kickNotificationWorker();
}

export async function respondFriendRequest(requestId: string, accept: boolean) {
  const { error } = await client().rpc('respond_friend_request', { request_id: requestId, accept });
  if (error) throw error;
  if (accept) kickNotificationWorker();
}

export async function removeFriend(targetId: string) {
  const { error } = await client().rpc('remove_friend', { target_id: targetId });
  if (error) throw error;
}

export async function blockUser(targetId: string) {
  const { error } = await client().rpc('block_user', { target_id: targetId });
  if (error) throw error;
}

export async function unblockUser(targetId: string) {
  const { error } = await client().rpc('unblock_user', { target_id: targetId });
  if (error) throw error;
}

export async function listBlockedUsers() {
  const { data, error } = await client().rpc('list_blocked_users');
  if (error) throw error;
  return (data ?? []) as BlockedUser[];
}

export async function createFriendInvite() {
  const { data, error } = await client().rpc('create_friend_invite');
  if (error) throw error;
  return data as string;
}

export async function getFriendInvite(token: string) {
  const { data, error } = await client().rpc('get_friend_invite', { raw_token: token });
  if (error) throw error;
  return (data?.[0] ?? null) as FriendInvite | null;
}

export async function acceptFriendInvite(token: string) {
  const { data, error } = await client().rpc('accept_friend_invite', { raw_token: token });
  if (error) throw error;
  kickNotificationWorker();
  return data as string;
}

export async function reportMoment(momentId: string, reason: 'nudity' | 'harassment' | 'violence' | 'impersonation' | 'spam' | 'other', details?: string) {
  const { error } = await client().rpc('report_moment', { target_moment_id: momentId, report_reason: reason, report_details: details ?? null });
  if (error) throw error;
}

export async function setMomentPublicConsent(momentId: string, consent: boolean, caption?: string) {
  const { data, error } = await client().rpc('set_moment_public_consent', { target_moment_id: momentId, consent, caption: caption ?? null });
  if (error) throw error;
  kickNotificationWorker();
  return data as 'private' | 'waiting_for_other' | 'public';
}

export async function listPublicMoments(offset = 0) {
  const { data, error } = await client().rpc('list_public_moments_v2', { result_limit: 20, result_offset: offset });
  if (error) throw error;
  const moments = (data ?? []) as PublicMoment[];
  const paths = [...new Set(moments.flatMap((moment) => [moment.side_one_path, moment.side_two_path]).filter(Boolean))];
  if (!paths.length) return moments;
  const { data: signed, error: signedError } = await client().storage.from('jello-photos').createSignedUrls(paths, 3600);
  if (signedError) throw signedError;
  const urls = new Map(signed.map((item, index) => [paths[index], item.signedUrl]));
  return moments.map((moment) => ({ ...moment, like_count: Number(moment.like_count), side_one_url: urls.get(moment.side_one_path) ?? undefined, side_two_url: urls.get(moment.side_two_path) ?? undefined }));
}

export async function recordPublicMomentImpressions(momentIds: string[]) {
  if (!momentIds.length) return;
  const { error } = await client().rpc('record_public_moment_impressions', { moment_ids: [...new Set(momentIds)].slice(0, 50) });
  if (error) throw error;
}

export async function togglePublicMomentLike(momentId: string) {
  const { data, error } = await client().rpc('toggle_public_moment_like', { target_moment_id: momentId });
  if (error) throw error;
  if (data) kickNotificationWorker();
  return Boolean(data);
}

export async function listNotifications(beforeTime?: string) {
  const { data, error } = await client().rpc('list_notifications', { result_limit: 40, before_time: beforeTime ?? null });
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function notificationUnreadCount() {
  const { data, error } = await client().rpc('notification_unread_count');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await client().rpc('mark_notification_read', { target_notification_id: notificationId });
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await client().rpc('mark_all_notifications_read');
  if (error) throw error;
}

export async function dismissNotification(notificationId: string) {
  const { error } = await client().rpc('dismiss_notification', { target_notification_id: notificationId });
  if (error) throw error;
}

export async function registerPushToken(token: string, deviceId: string, platform: 'ios' | 'android', appVersion?: string) {
  const { error } = await client().rpc('register_push_token', { push_token: token, target_device_id: deviceId, target_platform: platform, target_app_version: appVersion ?? null });
  if (error) throw error;
}

export async function deleteMyAccount() {
  const { error } = await client().rpc('delete_my_account', { confirmation: 'DELETE' });
  if (error) throw error;
}

async function uploadPhoto(momentId: string, side: 1 | 2, prepared: Promise<PreparedPhoto>) {
  const { data: sessionData } = await client().auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error('Sign in required.');
  const path = `${user.id}/${momentId}/${side}.jpg`;
  const photo = await prepared;
  const startedAt = Date.now();
  try {
    await withRetry(async () => {
      const { error } = await withTimeout(client().storage.from('jello-photos').upload(path, photo.bytes, {
        contentType: 'image/jpeg', cacheControl: '31536000', upsert: true,
      }), 15_000);
      if (error) throw error;
    });
    await withRetry(async () => {
      const { error } = await withTimeout(client().rpc('attach_moment_photo', {
        target_moment_id: momentId, photo_side: side, object_path: path,
        photo_width: photo.width, photo_height: photo.height,
      }), 10_000);
      if (error) throw error;
    });
    kickNotificationWorker();
    if (__DEV__) console.info('[photo-upload]', { side, bytes: photo.byteLength, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    await client().storage.from('jello-photos').remove([path]);
    throw error;
  }
}

export async function sendFirstSide(friendId: string, photo: CameraCapturedPicture, layout: MomentLayout, preparedPhoto?: Promise<PreparedPhoto>, requestKey = Crypto.randomUUID()) {
  const prepared = preparedPhoto ?? preparePhoto(photo);
  const momentRequest = client().rpc('create_moment', {
    target_id: friendId,
    request_key: requestKey,
    selected_layout: layout,
  });
  const { data, error } = await withTimeout(momentRequest, 10_000);
  if (error) throw error;
  const momentId = data as string;
  await uploadPhoto(momentId, 1, prepared);
  return momentId;
}

export async function sendReply(momentId: string, photo: CameraCapturedPicture, preparedPhoto?: Promise<PreparedPhoto>) {
  await uploadPhoto(momentId, 2, preparedPhoto ?? preparePhoto(photo));
}

export async function listMoments() {
  const { data, error } = await client().rpc('list_moments');
  if (error) throw error;
  const moments = (data ?? []) as Moment[];
  const paths = [...new Set(moments.flatMap((moment) => [moment.side_one_path, moment.side_two_path]).filter(Boolean) as string[])];
  if (!paths.length) return moments;
  const { data: signed, error: signedError } = await client().storage.from('jello-photos').createSignedUrls(paths, 3600);
  if (signedError) throw signedError;
  const urls = new Map(signed.map((item, index) => [paths[index], item.signedUrl]));
  return moments.map((moment) => ({
    ...moment,
    side_one_url: moment.side_one_path ? (urls.get(moment.side_one_path) ?? undefined) : undefined,
    side_two_url: moment.side_two_path ? (urls.get(moment.side_two_path) ?? undefined) : undefined,
  }));
}
