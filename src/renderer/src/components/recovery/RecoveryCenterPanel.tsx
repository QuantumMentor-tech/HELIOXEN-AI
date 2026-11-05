/**
 * HELIOXEN AI — Step 46: Recovery Center Panel
 * Crash Recovery, Verified Backups, Data Integrity, and Controlled Self-Repair Boundaries.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Wrench,
  Loader2,
  FolderArchive,
  Download,
  UploadCloud,
  Check,
  Info,
  Layers,
  Lock,
  Cpu
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import {
  RecoveryOverview,
  BackupManifest,
  DiagnosticReport,
  RestorePreview,
  ApprovedRepairId
} from '../../../../shared/recovery/types'
import { APPROVED_REPAIR_DEFINITIONS } from '../../../../shared/recovery/contracts'

export interface RecoveryCenterPanelProps {
  className?: string
}

export const RecoveryCenterPanel: React.FC<RecoveryCenterPanelProps> = ({ className = '' }) => {
  const [overview, setOverview] = useState<RecoveryOverview | null>(null)
  const [backups, setBackups] = useState<BackupManifest[]>([])
  const [diagnostics, setDiagnostics] = useState<DiagnosticReport | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false)
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null)

  // Modals & Confirmation States
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<string | null>(null)
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null)
  const [confirmRestoreChecked, setConfirmRestoreChecked] = useState<boolean>(false)
  const [isRestoring, setIsRestoring] = useState<boolean>(false)

  const [selectedRepair, setSelectedRepair] = useState<ApprovedRepairId | null>(null)
  const [isExecutingRepair, setIsExecutingRepair] = useState<boolean>(false)

  const api = typeof window !== 'undefined' ? (window as any).helioxen?.recovery : undefined

  const fetchOverviewAndBackups = useCallback(async () => {
    if (!api) return
    setIsLoading(true)
    try {
      const [ov, bkList] = await Promise.all([
        api.getStatus(),
        api.listBackups()
      ])
      setOverview(ov)
      setBackups(bkList || [])
    } catch (err: any) {
      setStatusMessage({ text: `Failed to load recovery status: ${err.message}`, type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    fetchOverviewAndBackups()
  }, [fetchOverviewAndBackups])

  const handleCreateBackup = async () => {
    if (!api) return
    setIsBackingUp(true)
    setStatusMessage({ text: 'Creating atomic verified backup snapshot...', type: 'info' })
    try {
      const res = await api.createBackup()
      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' })
        fetchOverviewAndBackups()
      } else {
        setStatusMessage({ text: res.message || res.error || 'Backup creation failed', type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Backup failed: ${err.message}`, type: 'error' })
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleVerifyBackup = async (backupId: string) => {
    if (!api) return
    setStatusMessage({ text: `Verifying checksums for ${backupId}...`, type: 'info' })
    try {
      const res = await api.verifyBackup(backupId)
      if (res.valid) {
        setStatusMessage({
          text: `Backup ${backupId} verified successfully! ${res.checkedArtifacts} stores match cryptographic hashes.`,
          type: 'success'
        })
      } else {
        setStatusMessage({
          text: `Verification FAILED for ${backupId}: ${res.errors.join('; ') || res.mismatchedChecksums.join(', ')}`,
          type: 'error'
        })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Verification error: ${err.message}`, type: 'error' })
    }
  }

  const handleOpenRestorePreview = async (backupId: string) => {
    if (!api) return
    setSelectedBackupForRestore(backupId)
    setConfirmRestoreChecked(false)
    try {
      const prev = await api.getRestorePreview(backupId)
      setRestorePreview(prev)
    } catch (err: any) {
      setStatusMessage({ text: `Failed to load restore preview: ${err.message}`, type: 'error' })
    }
  }

  const handleExecuteRestore = async () => {
    if (!api || !selectedBackupForRestore || !confirmRestoreChecked) return
    setIsRestoring(true)
    setStatusMessage({ text: `Restoring data from ${selectedBackupForRestore}...`, type: 'info' })
    try {
      const res = await api.executeRestore({
        backupId: selectedBackupForRestore,
        confirmedByHuman: true,
        createCheckpoint: true
      })
      if (res.success) {
        setStatusMessage({
          text: `${res.message} Checkpoint: ${res.checkpointCreated || 'saved'}.`,
          type: 'success'
        })
        setSelectedBackupForRestore(null)
        setRestorePreview(null)
        fetchOverviewAndBackups()
      } else {
        setStatusMessage({
          text: res.message || res.error || 'Restore operation failed.',
          type: 'error'
        })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Restore error: ${err.message}`, type: 'error' })
    } finally {
      setIsRestoring(false)
    }
  }

  const handleRunDiagnostics = async () => {
    if (!api) return
    setIsDiagnosing(true)
    setStatusMessage({ text: 'Running read-only system integrity diagnostics...', type: 'info' })
    try {
      const report = await api.runDiagnostics()
      setDiagnostics(report)
      setStatusMessage({
        text: `Diagnostics finished. ${report.findings.length} findings, ${report.availableRepairs.length} suggested repairs.`,
        type: 'info'
      })
    } catch (err: any) {
      setStatusMessage({ text: `Diagnostics failed: ${err.message}`, type: 'error' })
    } finally {
      setIsDiagnosing(false)
    }
  }

  const handleExecuteRepair = async (repairId: ApprovedRepairId) => {
    if (!api) return
    setIsExecutingRepair(true)
    setStatusMessage({ text: `Executing repair: ${repairId}...`, type: 'info' })
    try {
      const res = await api.executeRepair({
        repairId,
        confirmedByHuman: true
      })
      if (res.success) {
        setStatusMessage({
          text: `${res.message} (${res.changesSummary.join(', ') || 'No changes required'})`,
          type: 'success'
        })
        setSelectedRepair(null)
        handleRunDiagnostics()
        fetchOverviewAndBackups()
      } else {
        setStatusMessage({
          text: res.message || res.error || 'Self-repair execution failed.',
          type: 'error'
        })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Self-repair error: ${err.message}`, type: 'error' })
    } finally {
      setIsExecutingRepair(false)
    }
  }

  return (
    <div className={`max-w-7xl w-full mx-auto space-y-6 animate-hx-fade-in ${className}`}>
      {/* Top Banner Card */}
      <Card variant="panel" border="glow" padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-hx-space border border-hx-border-glow shadow-hx-glow-cyan-sm flex items-center justify-center text-hx-cyan shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-semibold text-hx-cyan flex items-center gap-2">
                Crash Recovery, Verified Backups &amp; Controlled Self-Repair
              </h2>
              <p className="text-xs text-hx-text-secondary leading-relaxed">
                Deterministic session reconciliation, SHA-256 verified snapshots, pre-restore safety checkpoints, and strictly bounded self-repair.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Badge
              variant={overview?.session.cleanShutdown ? 'nominal' : 'warning'}
              size="sm"
              isDot
            >
              {overview?.session.cleanShutdown ? 'SESSION HEALTH NOMINAL' : 'RECOVERY SYSTEM ACTIVE'}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchOverviewAndBackups}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Status Notice if present */}
      {statusMessage && (
        <div
          className={`p-3 rounded-hx-sm border text-xs flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : 'bg-hx-surface border-hx-border-glow text-hx-cyan'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-hx-text-muted hover:text-hx-text-primary ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Grid: Session Integrity & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Session Status & In-Flight Operations */}
        <Card variant="default" border="subtle" padding="md" className="space-y-4">
          <div className="flex items-center justify-between border-b border-hx-border-subtle/50 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-hx-cyan flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              Session Integrity
            </span>
            <Badge variant="info" size="sm">
              PID {overview?.session.pid || process.pid}
            </Badge>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-hx-border-subtle/30">
              <span className="text-hx-text-muted">Recovery State:</span>
              <span className="font-mono text-hx-text-primary font-medium">
                {overview?.session.recoveryState || 'normal_startup'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-hx-border-subtle/30">
              <span className="text-hx-text-muted">Clean Prior Exit:</span>
              <span className={overview?.session.cleanShutdown ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                {overview?.session.cleanShutdown ? 'YES' : 'UNVERIFIED / INTERRUPTED'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-hx-border-subtle/30">
              <span className="text-hx-text-muted">Active In-Flight Ops:</span>
              <span className="font-mono text-hx-cyan">
                {overview?.session.activeOperations.length || 0}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-hx-text-muted">Last Heartbeat:</span>
              <span className="font-mono text-hx-text-secondary text-[11px]">
                {overview?.session.lastHeartbeatAt
                  ? new Date(overview.session.lastHeartbeatAt).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Interrupted Operations Alert */}
          {overview?.session.activeOperations.some((op) => op.requiresUserReview) && (
            <div className="p-2.5 rounded-hx-sm bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Interrupted Operations Detected
              </div>
              <p className="text-[11px] leading-relaxed">
                External actions are blocked from auto-replay to prevent duplication. Reconcile to mark reviewed.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs"
                onClick={() => handleExecuteRepair('REPAIR_RECONCILE_STUCK_OPERATIONS')}
              >
                Reconcile Operations
              </Button>
            </div>
          )}
        </Card>

        {/* Card 2: Read-Only Diagnostics Engine */}
        <Card variant="default" border="subtle" padding="md" className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-hx-border-subtle/50 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-hx-cyan flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              Bounded System Diagnostics
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunDiagnostics}
              disabled={isDiagnosing}
              leftIcon={<Loader2 className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />}
            >
              {isDiagnosing ? 'Scanning...' : 'Run Diagnostics'}
            </Button>
          </div>

          {diagnostics ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-hx-text-muted">
                <span>Scan Report ID: {diagnostics.reportId}</span>
                <span>{new Date(diagnostics.generatedAt).toLocaleTimeString()}</span>
              </div>

              {diagnostics.findings.length === 0 ? (
                <div className="p-4 rounded-hx-sm bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>All application stores, session markers, and cache directories are clean and nominal.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {diagnostics.findings.map((f) => (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-hx-sm bg-hx-surface/70 border border-hx-border-subtle/50 text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              f.level === 'error' || f.level === 'critical'
                                ? 'danger'
                                : f.level === 'warning'
                                ? 'warning'
                                : 'info'
                            }
                            size="sm"
                          >
                            {f.level.toUpperCase()}
                          </Badge>
                          <span className="font-medium text-hx-text-primary">{f.title}</span>
                        </div>
                        <p className="text-[11px] text-hx-text-secondary leading-relaxed">{f.description}</p>
                      </div>

                      {f.suggestedRepairId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0 text-[11px]"
                          onClick={() => setSelectedRepair(f.suggestedRepairId as ApprovedRepairId)}
                        >
                          Repair...
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-hx-text-muted space-y-2">
              <Info className="w-6 h-6 mx-auto text-hx-cyan/60" />
              <p>Run a non-destructive diagnostic scan to inspect data store integrity, caches, and interrupted sessions.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Verified Backups Workspace */}
      <Card variant="default" border="subtle" padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hx-border-subtle/50 pb-2">
          <div>
            <h3 className="text-sm font-semibold text-hx-cyan flex items-center gap-2">
              <FolderArchive className="w-4 h-4" />
              Verified Application Backups ({backups.length})
            </h3>
            <p className="text-xs text-hx-text-muted">
              Consistent atomic snapshots with SHA-256 cryptographic verification and automatic pre-restore checkpoints.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            leftIcon={<UploadCloud className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />}
          >
            {isBackingUp ? 'Snapshotting...' : 'Create Verified Backup Now'}
          </Button>
        </div>

        {backups.length === 0 ? (
          <div className="py-8 text-center text-xs text-hx-text-muted space-y-2">
            <HardDrive className="w-6 h-6 mx-auto text-hx-cyan/60" />
            <p>No verified backups available yet. Create your first snapshot to protect user preferences, memory, and productivity records.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {backups.map((b) => (
              <div
                key={b.backupId}
                className="p-3 rounded-hx-sm bg-hx-surface/60 border border-hx-border-subtle/50 hover:border-hx-cyan/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-hx-text-primary">{b.backupId}</span>
                    <Badge variant="nominal" size="sm">
                      VERIFIED
                    </Badge>
                    <span className="text-[11px] text-hx-text-muted">
                      ({(b.totalSizeBytes / 1024).toFixed(1)} KB • {b.artifacts.length} stores)
                    </span>
                  </div>
                  <div className="text-[11px] text-hx-text-secondary flex flex-wrap gap-1">
                    {b.includedCategories.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-hx-panel/60 border border-hx-border-subtle/30 font-mono text-[10px]">
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-hx-text-muted font-mono">
                    Captured: {new Date(b.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleVerifyBackup(b.backupId)}
                    leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                  >
                    Verify Checksums
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenRestorePreview(b.backupId)}
                    leftIcon={<History className="w-3.5 h-3.5" />}
                  >
                    Restore...
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Approved Self-Repair Catalog Card */}
      <Card variant="default" border="subtle" padding="md" className="space-y-4">
        <div className="flex items-center justify-between border-b border-hx-border-subtle/50 pb-2">
          <div>
            <h3 className="text-sm font-semibold text-hx-cyan flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Approved Self-Repair Catalog
            </h3>
            <p className="text-xs text-hx-text-muted">
              Narrowly scoped, deterministic repair actions. Arbitrary shell execution and source code mutation are permanently banned.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(APPROVED_REPAIR_DEFINITIONS).map((rep) => (
            <div
              key={rep.id}
              className="p-3 rounded-hx-sm bg-hx-surface/50 border border-hx-border-subtle/40 flex flex-col justify-between gap-3 text-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-hx-text-primary text-xs">{rep.name}</span>
                  <Badge
                    variant={
                      rep.riskLevel === 'high' ? 'danger' : rep.riskLevel === 'moderate' ? 'warning' : 'nominal'
                    }
                    size="sm"
                  >
                    {rep.riskLevel.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-[11px] text-hx-text-secondary leading-relaxed">{rep.description}</p>
                <div className="text-[10px] font-mono text-hx-text-muted">
                  Targets: {rep.allowedTargetPaths.join(', ')}
                </div>
              </div>

              <Button
                variant={rep.riskLevel === 'high' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedRepair(rep.id)}
                disabled={isExecutingRepair}
                className="w-full text-xs"
              >
                Execute Repair
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* RESTORE CONFIRMATION MODAL */}
      {selectedBackupForRestore && restorePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-hx-fade-in">
          <Card variant="panel" border="glow" padding="lg" className="max-w-xl w-full space-y-4 shadow-hx-glow-cyan-md">
            <div className="flex items-center justify-between border-b border-hx-border-subtle/50 pb-2">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Confirm Application Data Restoration
              </div>
              <button
                type="button"
                onClick={() => setSelectedBackupForRestore(null)}
                className="text-hx-text-muted hover:text-hx-text-primary text-sm"
              >
                ×
              </button>
            </div>

            <div className="p-3 rounded-hx-sm bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 space-y-2">
              <p className="font-medium">{restorePreview.warningMessage}</p>
              <p className="text-[11px] text-rose-300">
                A pre-restore recovery checkpoint will be saved prior to applying changes. If validation fails, changes will be rolled back automatically.
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-semibold text-hx-text-primary">Affected Active Stores:</span>
              <ul className="list-disc list-inside text-hx-text-secondary text-[11px] font-mono space-y-0.5">
                {restorePreview.affectedStores.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>

            <label className="flex items-center gap-2 text-xs text-hx-text-primary cursor-pointer select-none pt-2">
              <input
                type="checkbox"
                checked={confirmRestoreChecked}
                onChange={(e) => setConfirmRestoreChecked(e.target.checked)}
                className="rounded border-hx-border-subtle bg-hx-surface text-hx-cyan focus:ring-0"
              />
              <span>I confirm that active data stores will be replaced with this backup snapshot.</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-hx-border-subtle/50">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedBackupForRestore(null)}
                disabled={isRestoring}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!confirmRestoreChecked || isRestoring}
                onClick={handleExecuteRestore}
                leftIcon={<Loader2 className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />}
              >
                {isRestoring ? 'Restoring...' : 'Confirm & Restore'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* REPAIR CONFIRMATION MODAL */}
      {selectedRepair && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-hx-fade-in">
          <Card variant="panel" border="glow" padding="lg" className="max-w-md w-full space-y-4 shadow-hx-glow-cyan-md">
            <div className="flex items-center justify-between border-b border-hx-border-subtle/50 pb-2">
              <div className="flex items-center gap-2 text-hx-cyan font-semibold text-sm">
                <Wrench className="w-4 h-4" />
                Confirm Self-Repair
              </div>
              <button
                type="button"
                onClick={() => setSelectedRepair(null)}
                className="text-hx-text-muted hover:text-hx-text-primary text-sm"
              >
                ×
              </button>
            </div>

            <div className="text-xs space-y-2 text-hx-text-secondary">
              <div className="font-semibold text-hx-text-primary">
                {APPROVED_REPAIR_DEFINITIONS[selectedRepair]?.name}
              </div>
              <p>{APPROVED_REPAIR_DEFINITIONS[selectedRepair]?.description}</p>
              <div className="p-2 rounded bg-hx-surface/50 border border-hx-border-subtle text-[11px] font-mono text-hx-text-muted">
                Targets: {APPROVED_REPAIR_DEFINITIONS[selectedRepair]?.allowedTargetPaths.join(', ')}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-hx-border-subtle/50">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRepair(null)}
                disabled={isExecutingRepair}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isExecutingRepair}
                onClick={() => handleExecuteRepair(selectedRepair)}
                leftIcon={<Loader2 className={`w-3.5 h-3.5 ${isExecutingRepair ? 'animate-spin' : ''}`} />}
              >
                {isExecutingRepair ? 'Executing...' : 'Proceed with Repair'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Architectural Guarantee Summary */}
      <Card variant="default" border="subtle" padding="sm" className="bg-hx-surface/40 text-xs text-hx-text-muted">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-hx-cyan shrink-0" />
            <span>
              <strong>Reliability &amp; Self-Repair Boundaries:</strong> External operations are never replayed upon crash. Backups are SHA-256 verified. Source code mutation and arbitrary shell execution are strictly prohibited.
            </span>
          </div>
          <span className="font-mono text-[10px] shrink-0 text-hx-text-secondary">
            Phase 16 • Step 46 of 48
          </span>
        </div>
      </Card>
    </div>
  )
}
