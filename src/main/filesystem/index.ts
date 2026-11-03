/**
 * HELIOXEN AI — Step 29: Main Process Filesystem Services
 * Exports authoritative singleton instances for filesystem and clipboard operations.
 */

import { AuthorizedPathManager, authorizedPathManager } from './AuthorizedPathManager'
import { FileOperationsManager, fileOperationsManager } from './FileOperationsManager'
import { ClipboardManager, clipboardManager } from './ClipboardManager'
import { FileOrganizationManager, fileOrganizationManager } from './FileOrganizationManager'

export * from './AuthorizedPathManager'
export * from './FileOperationsManager'
export * from './ClipboardManager'
export * from './FileOrganizationManager'

export {
  authorizedPathManager,
  fileOperationsManager,
  clipboardManager,
  fileOrganizationManager
}

