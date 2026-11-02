import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CameraCapturedPicture } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { preparePhoto, sendFirstSide, sendReply, type MomentLayout, type PreparedPhoto } from './api';

const STORAGE_KEY = 'jello.photo-outbox.v1';
const jobs = new Map<string, OutboxJob>();
const prepared = new Map<string, Promise<PreparedPhoto>>();
let hydrated = false;
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

type PhotoRef = Pick<CameraCapturedPicture, 'uri' | 'width' | 'height'>;
type OutboxJob = {
  id: string;
  kind: 'first' | 'reply';
  photo: PhotoRef;
  friendId?: string;
  momentId?: string;
  layout?: MomentLayout;
  requestKey: string;
  attempts: number;
  createdAt: number;
};

async function hydrate() {
  if (hydrated) return;
  const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (stored) {
    try { for (const job of JSON.parse(stored) as OutboxJob[]) if (!jobs.has(job.id)) jobs.set(job.id, job); }
    catch { await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined); }
  }
  hydrated = true;
}

const persist = () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...jobs.values()])).catch(() => undefined);

function schedule(milliseconds: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = undefined; void drain(); }, milliseconds);
}

async function drain() {
  await hydrate();
  if (running || !jobs.size) return;
  running = true;
  try {
    for (const job of [...jobs.values()]) {
      try {
        const pending = prepared.get(job.id) ?? preparePhoto(job.photo as CameraCapturedPicture);
        if (job.kind === 'first' && job.friendId && job.layout) await sendFirstSide(job.friendId, job.photo as CameraCapturedPicture, job.layout, pending, job.requestKey);
        else if (job.kind === 'reply' && job.momentId) await sendReply(job.momentId, job.photo as CameraCapturedPicture, pending);
        jobs.delete(job.id);
        prepared.delete(job.id);
        await persist();
      } catch {
        job.attempts += 1;
        jobs.set(job.id, job);
        await persist();
        schedule(Math.min(30_000, 750 * (2 ** Math.min(job.attempts, 5))) + Math.random() * 500);
        break;
      }
    }
  } finally {
    running = false;
  }
}

function enqueue(job: OutboxJob, preparation?: Promise<PreparedPhoto>) {
  if (preparation) prepared.set(job.id, preparation);
  void hydrate().then(() => {
    jobs.set(job.id, job);
    void persist();
    void drain();
  });
  return job.id;
}

export function enqueueFirstSide(friendId: string, photo: CameraCapturedPicture, layout: MomentLayout, preparation?: Promise<PreparedPhoto>) {
  const id = Crypto.randomUUID();
  return enqueue({ id, kind: 'first', friendId, photo: { uri: photo.uri, width: photo.width, height: photo.height }, layout, requestKey: id, attempts: 0, createdAt: Date.now() }, preparation);
}

export function enqueueReply(momentId: string, photo: CameraCapturedPicture, preparation?: Promise<PreparedPhoto>) {
  const id = Crypto.randomUUID();
  return enqueue({ id, kind: 'reply', momentId, photo: { uri: photo.uri, width: photo.width, height: photo.height }, requestKey: id, attempts: 0, createdAt: Date.now() }, preparation);
}

export function startPhotoOutbox() { void drain(); }
