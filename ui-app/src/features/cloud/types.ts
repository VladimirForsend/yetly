import type { SupabaseConnectionConfig } from "../../infrastructure/supabase/supabase-connection";

export type CloudSetupState =
  | "idle"
  | "authorizing"
  | "choosing-target"
  | "provisioning"
  | "ready"
  | "error";

export interface ProvisioningOrganization {
  id: string;
  name: string;
}

export interface ProvisioningProject {
  ref: string;
  name: string;
  organizationId: string;
  region?: string;
  status?: string;
  compatible: boolean;
  incompatibilityReason?: string;
}

export interface ProvisioningTarget {
  organizations: ProvisioningOrganization[];
  projects: ProvisioningProject[];
  canCreateProjects: boolean;
  canInstallExistingProjects: boolean;
}

export type ProvisioningPhase =
  | "project"
  | "availability"
  | "database"
  | "auth"
  | "keys"
  | "storage-realtime"
  | "edge-function"
  | "verification";

export interface ProvisioningJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "needs_reauthorization";
  phase: ProvisioningPhase;
  progress: number;
  message: string;
  recoverable: boolean;
  projectRef?: string;
  projectDashboardUrl?: string;
  errorCode?: string;
  connection?: ManagedSupabaseConnection;
}

export interface ManagedSupabaseConnection extends SupabaseConnectionConfig {
  managed: true;
  projectRef: string;
  installationId: string;
  schemaVersion: number;
  controlPlaneUrl: string;
}

export interface CloudMigrationBundleV2 {
  format: "yetly-local-migration";
  version: 2;
  installationId: string;
  exportedAt: string;
  workspaceJson: string;
  attachmentCount: number;
}

export interface MigrationIssue {
  entityType: string;
  localId?: string;
  message: string;
  recoverable: boolean;
}

export interface MigrationReport {
  installationId: string;
  completedAt: string;
  projects: number;
  teams: number;
  tasks: number;
  checklistItems: number;
  messages: number;
  timeEntries: number;
  workflowConnections: number;
  attachments: number;
  skipped: number;
  issues: MigrationIssue[];
}
