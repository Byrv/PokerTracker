import type { DbBoundary } from '@/lib/db/boundary';
import type { SessionId } from '@/lib/modules/core';
import { createMedia } from './internal/factory';
export * from './types';

export interface Media {
  listNotes(sessionId: SessionId): Promise<import('./types').Note[]>;
  addNote(input: { sessionId: SessionId; body: string }): Promise<import('./types').Note>;
  editNote(id: string, body: string): Promise<import('./types').Note>;
  deleteNote(id: string): Promise<void>;

  listPhotos(sessionId: SessionId): Promise<import('./types').Photo[]>;
  uploadPhoto(input: {
    sessionId: SessionId;
    file: File;
    caption?: string;
  }): Promise<import('./types').Photo>;
  deletePhoto(id: string): Promise<void>;
}

export const withBoundary = (b: DbBoundary): Media => createMedia(b);
