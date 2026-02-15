/**
 * Workspace Module
 * 
 * Exports workspace adapter and related types.
 */

export { WorkspaceAdapter, type WorkspaceFileSystem } from './workspace-adapter';
export {
  validateSpecConfig,
  validateSpecFolder,
  validateAllSpecs,
  type SpecConfigSchema,
  type SpecFolderSchema,
  type ValidationFileSystem,
} from './spec-schema';
