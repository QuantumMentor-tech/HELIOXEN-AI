/**
 * HELIOXEN AI — Step 30: Desktop Interaction & System Operations Contracts
 * Strict Zod validation schemas for all desktop and system interaction requests.
 */

import { z } from 'zod'
import { ALLOWLISTED_KEYBOARD_SHORTCUTS } from './types'

// Target Reference Schema
export const TargetWindowReferenceSchema = z
  .object({
    windowId: z.string().min(1, 'Target windowId cannot be empty').max(128),
    expectedAppAssociation: z.string().max(128).optional(),
    expectedTitleSubstring: z.string().max(256).optional()
  })
  .strict()

// Target Validation Result Schema
export const TargetValidationResultSchema = z.object({
  isValid: z.boolean(),
  windowId: z.string(),
  title: z.string(),
  appAssociation: z.string(),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number()
  }),
  isFocused: z.boolean(),
  isSelfApp: z.boolean(),
  reason: z.string().optional()
})

// Keyboard Action Schemas
export const NamedKeyboardShortcutSchema = z.enum(ALLOWLISTED_KEYBOARD_SHORTCUTS)

export const KeyboardModifierSchema = z.enum(['shift', 'control', 'alt', 'meta'])

export const KeyboardActionRequestSchema = z
  .object({
    target: TargetWindowReferenceSchema,
    shortcut: NamedKeyboardShortcutSchema,
    modifiers: z.array(KeyboardModifierSchema).max(4).optional()
  })
  .strict()

export const TextEntryRequestSchema = z
  .object({
    target: TargetWindowReferenceSchema,
    text: z.string().min(1, 'Text cannot be empty').max(2000, 'Text exceeds 2000 characters limit'),
    maxChars: z.number().int().min(1).max(2000).default(500).optional()
  })
  .strict()

export const KeyboardActionResultSchema = z.object({
  success: z.boolean(),
  action: z.string(),
  targetWindowId: z.string(),
  timestamp: z.string(),
  undoable: z.boolean(),
  undoToken: z.string().optional(),
  error: z.string().optional()
})

// Mouse Action Schemas
export const MouseButtonSchema = z.enum(['left', 'right', 'middle'])

export const MouseClickRequestSchema = z
  .object({
    target: TargetWindowReferenceSchema,
    x: z.number().int().min(0, 'x coordinate must be non-negative'),
    y: z.number().int().min(0, 'y coordinate must be non-negative'),
    button: MouseButtonSchema.default('left').optional(),
    clickCount: z.union([z.literal(1), z.literal(2)]).default(1).optional()
  })
  .strict()

export const MouseScrollRequestSchema = z
  .object({
    target: TargetWindowReferenceSchema,
    deltaX: z.number().int().min(-1000).max(1000).default(0).optional(),
    deltaY: z.number().int().min(-1000).max(1000).default(0).optional()
  })
  .strict()

export const MouseActionResultSchema = z.object({
  success: z.boolean(),
  actionType: z.enum(['click', 'scroll']),
  targetWindowId: z.string(),
  coordinates: z
    .object({
      x: z.number(),
      y: z.number()
    })
    .optional(),
  scrollDelta: z
    .object({
      deltaX: z.number(),
      deltaY: z.number()
    })
    .optional(),
  timestamp: z.string(),
  undoable: z.literal(false),
  error: z.string().optional()
})

// Predefined System Operation Schemas
export const SystemOpenPathRequestSchema = z
  .object({
    targetPath: z.string().min(1, 'Target path cannot be empty').max(1024)
  })
  .strict()

export const SystemOpenPathResultSchema = z.object({
  success: z.boolean(),
  targetPath: z.string(),
  openedAt: z.string(),
  error: z.string().optional()
})

export const SystemShowInFolderRequestSchema = z
  .object({
    targetPath: z.string().min(1, 'Target path cannot be empty').max(1024)
  })
  .strict()

export const SystemShowInFolderResultSchema = z.object({
  success: z.boolean(),
  targetPath: z.string(),
  revealedAt: z.string(),
  error: z.string().optional()
})

const HTTP_URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

export const SystemOpenUrlRequestSchema = z
  .object({
    url: z
      .string()
      .min(8, 'URL is too short')
      .max(2048, 'URL exceeds length limit')
      .regex(HTTP_URL_REGEX, 'Only safe HTTP and HTTPS URLs are permitted')
  })
  .strict()

export const SystemOpenUrlResultSchema = z.object({
  success: z.boolean(),
  url: z.string(),
  domain: z.string(),
  openedAt: z.string(),
  error: z.string().optional()
})

export const SystemAlertBeepResultSchema = z.object({
  success: z.boolean(),
  beepedAt: z.string()
})

export const DisplayMetricsResultSchema = z.object({
  primaryDisplay: z.object({
    id: z.number(),
    bounds: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    workArea: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    scaleFactor: z.number()
  }),
  allDisplaysCount: z.number().int().min(1),
  queriedAt: z.string()
})

// Emergency Stop & Undo Schemas
export const EmergencyStopResultSchema = z.object({
  stopped: z.boolean(),
  pendingActionsCleared: z.number().int().min(0),
  heldModifiersReleased: z.array(z.string()),
  timestamp: z.string()
})

export const UndoInteractionRequestSchema = z
  .object({
    undoToken: z.string().min(1).max(128).optional()
  })
  .strict()

export const UndoInteractionResultSchema = z.object({
  success: z.boolean(),
  revertedUndoToken: z.string().optional(),
  description: z.string(),
  timestamp: z.string(),
  error: z.string().optional()
})

