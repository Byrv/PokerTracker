import type { SessionId, UserId } from '@/lib/modules/core';

export type Note = {
  id: string;
  sessionId: SessionId;
  authorUserId: UserId;
  body: string;
  createdAt: string;
  updatedAt: string;
};
export type Photo = {
  id: string;
  sessionId: SessionId;
  uploadedBy: UserId;
  url: string;
  caption?: string;
  createdAt: string;
};
