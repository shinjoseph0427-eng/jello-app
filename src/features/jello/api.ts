import type { CameraCapturedPicture } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

export type Friend = { id: string; username: string; display_name: string; avatar_path: string | null; username_completed?: boolean };
export type IncomingRequest = Friend & { request_id: string; sender_id: string; created_at: string };
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
};
export type MomentLayout = 'vertical' | 'horizontal';
export type PreparedPhoto = { uri: string; width: number; height: number; bytes: ArrayBuffer; byteLength: number };

const MAX_PHOTO_EDGE = 1536;
const JPEG_QUALITY = 0.72;

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) { lastError = error; if (attempt < attempts - 1) await delay(250 * (2 ** attempt)); }
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
}

export async function respondFriendRequest(requestId: string, accept: boolean) {
  const { error } = await client().rpc('respond_friend_request', { request_id: requestId, accept });
  if (error) throw error;
}

export async function removeFriend(targetId: string) {
  const { error } = await client().rpc('remove_friend', { target_id: targetId });
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
      const { error } = await client().storage.from('jello-photos').upload(path, photo.bytes, {
        contentType: 'image/jpeg', cacheControl: '31536000', upsert: true,
      });
      if (error) throw error;
    });
    await withRetry(async () => {
      const { error } = await client().rpc('attach_moment_photo', {
        target_moment_id: momentId, photo_side: side, object_path: path,
        photo_width: photo.width, photo_height: photo.height,
      });
      if (error) throw error;
    });
    if (__DEV__) console.info('[photo-upload]', { side, bytes: photo.byteLength, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    await client().storage.from('jello-photos').remove([path]);
    throw error;
  }
}

export async function sendFirstSide(friendId: string, photo: CameraCapturedPicture, layout: MomentLayout, preparedPhoto?: Promise<PreparedPhoto>) {
  const prepared = preparedPhoto ?? preparePhoto(photo);
  const momentRequest = client().rpc('create_moment', {
    target_id: friendId,
    request_key: Crypto.randomUUID(),
    selected_layout: layout,
  });
  const { data, error } = await momentRequest;
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
