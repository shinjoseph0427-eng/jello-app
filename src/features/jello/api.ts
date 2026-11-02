import type { CameraCapturedPicture } from 'expo-camera';
import * as Crypto from 'expo-crypto';
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
};

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
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

async function uploadPhoto(momentId: string, side: 1 | 2, photo: CameraCapturedPicture) {
  const { data: userData, error: userError } = await client().auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in required.');
  const path = `${userData.user.id}/${momentId}/${side}.jpg`;
  const response = await fetch(photo.uri);
  if (!response.ok) throw new Error('Could not read the captured photo.');
  const bytes = await response.arrayBuffer();
  const { error: uploadError } = await client().storage.from('jello-photos').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { error: attachError } = await client().rpc('attach_moment_photo', {
    target_moment_id: momentId,
    photo_side: side,
    object_path: path,
    photo_width: photo.width,
    photo_height: photo.height,
  });
  if (attachError) {
    await client().storage.from('jello-photos').remove([path]);
    throw attachError;
  }
}

export async function sendFirstSide(friendId: string, photo: CameraCapturedPicture) {
  const { data, error } = await client().rpc('create_moment', {
    target_id: friendId,
    request_key: Crypto.randomUUID(),
  });
  if (error) throw error;
  const momentId = data as string;
  await uploadPhoto(momentId, 1, photo);
  return momentId;
}

export async function sendReply(momentId: string, photo: CameraCapturedPicture) {
  await uploadPhoto(momentId, 2, photo);
}

export async function listMoments() {
  const { data, error } = await client().rpc('list_moments');
  if (error) throw error;
  const moments = (data ?? []) as Moment[];
  return Promise.all(moments.map(async (moment) => {
    const paths = [moment.side_one_path, moment.side_two_path].filter(Boolean) as string[];
    if (!paths.length) return moment;
    const { data: signed, error: signedError } = await client().storage.from('jello-photos').createSignedUrls(paths, 3600);
    if (signedError) throw signedError;
    const urls = new Map(signed.map((item, index) => [paths[index], item.signedUrl]));
    return {
      ...moment,
      side_one_url: moment.side_one_path ? (urls.get(moment.side_one_path) ?? undefined) : undefined,
      side_two_url: moment.side_two_path ? (urls.get(moment.side_two_path) ?? undefined) : undefined,
    };
  }));
}
