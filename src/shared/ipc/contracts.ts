import { z } from 'zod'

/**
 * Strict No-Args Request Schema:
 * Rejects unexpected arguments, malicious injections, or malformed payloads sent to parameterless handlers.
 */
export const VoidRequestSchema = z.union([z.undefined(), z.null(), z.object({}).strict()])

/**
 * Window Controls Schemas
 */
export const WindowMinimizeRequestSchema = VoidRequestSchema
export type WindowMinimizeRequest = z.infer<typeof WindowMinimizeRequestSchema>

export const WindowMaximizeRequestSchema = VoidRequestSchema
export type WindowMaximizeRequest = z.infer<typeof WindowMaximizeRequestSchema>

export const WindowCloseRequestSchema = VoidRequestSchema
export type WindowCloseRequest = z.infer<typeof WindowCloseRequestSchema>

export const WindowIsMaximizedRequestSchema = VoidRequestSchema
export type WindowIsMaximizedRequest = z.infer<typeof WindowIsMaximizedRequestSchema>

export const WindowIsMaximizedResponseSchema = z.boolean()
export type WindowIsMaximizedResponse = z.infer<typeof WindowIsMaximizedResponseSchema>

/**
 * Event Schemas (Main -> Renderer)
 */
export const WindowMaximizedChangeEventSchema = z.boolean()
export type WindowMaximizedChangeEvent = z.infer<typeof WindowMaximizedChangeEventSchema>
