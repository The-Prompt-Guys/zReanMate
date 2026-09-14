import { z } from 'zod';

/**
 * Request schemas for kits, folders and sources. Every endpoint validates
 * against one of these before its controller runs (CLAUDE.md, Hard rules).
 */

/** Semantic tokens, not colours — KitCard maps these to classes itself. */
export const KIT_ACCENTS = ['blue', 'violet', 'amber', 'teal'];
export const KIT_ICONS = ['document', 'database', 'code', 'share'];

/** Mirrors study_kits_status_check. */
export const KIT_STATUSES = ['in_progress', 'completed', 'archived'];

const uuid = z.uuid('Not a valid id');

export const kitIdParams = z.object({ kitId: uuid });
export const sourceIdParams = z.object({ kitId: uuid, sourceId: uuid });
export const folderIdParams = z.object({ folderId: uuid });

/**
 * The Kits tab filter is All / In progress / Completed, so `status` is
 * optional and 'all' is expressed by omitting it.
 */
export const kitListQuery = z.object({
  status: z.enum(KIT_STATUSES).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const createKitSchema = z.object({
  title: z.string().trim().min(1, 'Give the kit a name').max(200),
  titleKm: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  subject: z.string().trim().max(200).optional(),
  folderId: uuid.nullable().optional(),
  icon: z.enum(KIT_ICONS).optional(),
  accent: z.enum(KIT_ACCENTS).optional(),
});

export const updateKitSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    titleKm: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    subject: z.string().trim().max(200).optional(),
    folderId: uuid.nullable().optional(),
    icon: z.enum(KIT_ICONS).optional(),
    accent: z.enum(KIT_ACCENTS).optional(),
    status: z.enum(KIT_STATUSES).optional(),
    progress: z.number().int().min(0).max(100).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Send at least one field to update',
  });

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Give the folder a name').max(200),
  color: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(40).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const updateFolderSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(200).optional(),
    color: z.string().trim().max(40).optional(),
    icon: z.string().trim().max(40).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Send at least one field to update',
  });

export const createSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('youtube'),
    url: z.string().trim().min(1, 'Enter a YouTube URL'),
    title: z.string().trim().max(200).optional(),
  }),
  z.object({
    kind: z.literal('topic'),
    title: z.string().trim().min(1, 'Enter a topic name').max(200),
  }),
]);
