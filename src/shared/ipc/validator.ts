import { z, ZodError } from 'zod'
import { IpcException } from './errors'

/**
 * Validates an incoming IPC request payload against a Zod schema.
 * Throws a normalized IpcException with code VALIDATION_ERROR if validation fails.
 */
export function validateIpcPayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const errorDetails = formatZodIssues(result.error)
    throw new IpcException(
      'VALIDATION_ERROR',
      `Malformed IPC request payload: ${errorDetails.summary}`,
      errorDetails.fieldErrors
    )
  }
  return result.data
}

/**
 * Formats Zod issues into safe, non-sensitive summary details.
 */
function formatZodIssues(error: ZodError): {
  summary: string
  fieldErrors: Record<string, string>
} {
  const fieldErrors: Record<string, string> = {}
  const messages: string[] = []

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root'
    fieldErrors[path] = issue.message
    messages.push(`${path}: ${issue.message}`)
  }

  return {
    summary: messages.join('; ') || 'Invalid structure',
    fieldErrors
  }
}
