import type { DbBoundary, NoteRow, PhotoRow, SessionRow } from '@/lib/db/boundary';
import { asSessionId, asUserId } from '@/lib/modules/core';
import type { Media } from '../index';
import type { Note, Photo } from '../types';

const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MiB matches storage file_size_limit
const SIGNED_URL_TTL = 3600;

function noteRowToDto(r: NoteRow): Note {
  return {
    id: r.id,
    sessionId: asSessionId(r.session_id),
    authorUserId: asUserId(r.author_user_id),
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function photoRowToDto(b: DbBoundary, r: PhotoRow): Promise<Photo> {
  const url = await b.storage.getSignedUrl(r.storage_path, SIGNED_URL_TTL);
  const dto: Photo = {
    id: r.id,
    sessionId: asSessionId(r.session_id),
    uploadedBy: asUserId(r.uploaded_by),
    url,
    createdAt: r.created_at,
  };
  if (r.caption !== null && r.caption !== undefined) dto.caption = r.caption;
  return dto;
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

function sanitizeFileName(name: string): string {
  // Avoid path separators and whitespace in storage keys.
  return name.replace(/[\\/\s]+/g, '_');
}

export function createMedia(b: DbBoundary): Media {
  async function requireAuthed() {
    const me = await b.auth.getCurrentUser();
    if (!me) throw new Error('not_authenticated');
    return me;
  }

  async function requireParticipant(sessionId: string): Promise<{ id: string; email: string }> {
    const me = await requireAuthed();
    const session = await b.sessions.get(sessionId);
    if (!session) throw new Error('session_not_found');
    const participants = await b.sessions.listParticipants(sessionId);
    const isParticipant =
      session.created_by === me.id || participants.some((p) => p.user_id === me.id);
    if (!isParticipant) throw new Error('not_participant');
    return me;
  }

  async function requireOpenSessionForWrite(sessionId: string): Promise<SessionRow> {
    const session = await b.sessions.get(sessionId);
    if (!session) throw new Error('session_not_found');
    if (session.status === 'closed') throw new Error('session_closed');
    return session;
  }

  return {
    async listNotes(sessionId) {
      await requireParticipant(sessionId);
      const rows = await b.notes.listForSession(sessionId);
      // Newest first.
      const sorted = [...rows].sort((a, c) => c.created_at.localeCompare(a.created_at));
      return sorted.map(noteRowToDto);
    },

    async addNote({ sessionId, body }) {
      if (!body || body.trim().length === 0) throw new Error('empty_body');
      const me = await requireParticipant(sessionId);
      await requireOpenSessionForWrite(sessionId);
      const row = await b.notes.create({
        session_id: sessionId,
        author_user_id: me.id,
        body,
      });
      return noteRowToDto(row);
    },

    async editNote(id, body) {
      if (!body || body.trim().length === 0) throw new Error('empty_body');
      const me = await requireAuthed();
      // Boundary doesn't expose a getById for notes. We rely on update returning
      // the row so we can verify authorship; in production RLS (notes_update_author)
      // blocks the write up-front, so this is a defensive in-app check.
      const row = await b.notes.update(id, body);
      if (row.author_user_id !== me.id) throw new Error('not_author');
      await requireOpenSessionForWrite(row.session_id);
      return noteRowToDto(row);
    },

    async deleteNote(id) {
      const me = await requireAuthed();
      // Same getById limitation as editNote. We probe via update to recover the
      // row's metadata, verify authorship, then delete. In production RLS blocks
      // the probe up-front for non-authors; in unit tests we do the check
      // ourselves.
      let row: NoteRow;
      try {
        row = await b.notes.update(id, '__delete_probe__');
      } catch (e) {
        throw e instanceof Error ? e : new Error('not_found');
      }
      if (row.author_user_id !== me.id) throw new Error('not_author');
      await requireOpenSessionForWrite(row.session_id);
      await b.notes.delete(id);
    },

    async listPhotos(sessionId) {
      await requireParticipant(sessionId);
      const rows = await b.photos.listForSession(sessionId);
      const sorted = [...rows].sort((a, c) => c.created_at.localeCompare(a.created_at));
      return Promise.all(sorted.map((r) => photoRowToDto(b, r)));
    },

    async uploadPhoto({ sessionId, file, caption }) {
      const me = await requireParticipant(sessionId);
      await requireOpenSessionForWrite(sessionId);
      if (file.size > MAX_PHOTO_BYTES) throw new Error('too_large');
      const mime = file.type;
      if (!mime || !mime.startsWith('image/')) throw new Error('invalid_mime');
      const safeName = sanitizeFileName(file.name || `upload.${fileExtension(file.name) || 'bin'}`);
      const storage_path = `session-${sessionId}/${crypto.randomUUID()}-${safeName}`;
      await b.storage.upload(storage_path, file, mime);
      const insert: Parameters<typeof b.photos.create>[0] = {
        session_id: sessionId,
        uploaded_by: me.id,
        storage_path,
      };
      if (caption !== undefined) insert.caption = caption;
      const row = await b.photos.create(insert);
      return photoRowToDto(b, row);
    },

    async deletePhoto(id) {
      const me = await requireAuthed();
      // Photos boundary has no getById and no update. We locate the row by
      // scanning the photo lists of sessions the user can see is impractical,
      // so we trust that the production RLS (photos_delete_uploader) enforces
      // uploader-only deletion. For the unit-test fake we do best-effort by
      // searching across all photos via the dump escape hatch when present.
      const rows = await findPhotoRowById(b, id);
      if (!rows) throw new Error('not_found');
      if (rows.uploaded_by !== me.id) throw new Error('not_uploader');
      await requireOpenSessionForWrite(rows.session_id);
      await b.photos.delete(id);
      await b.storage.remove(rows.storage_path);
    },
  };
}

// Helper: locate a photo row across sessions. The boundary contract only exposes
// `listForSession`, which forces us to either know the session up front or to
// search. We search all sessions (read-only `sessions.list()`) — this matches the
// "least-trust" rule: do the work in app code rather than expand the boundary.
async function findPhotoRowById(b: DbBoundary, id: string): Promise<PhotoRow | null> {
  const sessions = await b.sessions.list();
  for (const s of sessions) {
    const photos = await b.photos.listForSession(s.id);
    const hit = photos.find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}
