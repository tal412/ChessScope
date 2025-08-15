/**
 * Advanced conflict detection service for chess studies
 * Uses multiple strategies to identify conflicts at different granularity levels
 */
class ConflictDetectionService {
  constructor() {
    this.lastSyncTimestamp = null;
  }

  /**
   * Main conflict detection method - uses multiple strategies
   */
  async detectConflicts(localData, remoteData, lastSyncTime = null) {
    const conflicts = {
      hasConflicts: false,
      level: 'none', // 'none', 'metadata', 'structure', 'content'
      details: [],
      resolutionSuggestions: []
    };

    // Strategy 1: Quick timestamp check
    const timestampConflicts = this.detectTimestampConflicts(localData, remoteData, lastSyncTime);
    
    // Strategy 2: Structural comparison (studies, folders, tags counts)
    const structuralConflicts = this.detectStructuralConflicts(localData, remoteData);
    
    // Strategy 3: Content hash comparison (deep content)
    const contentConflicts = await this.detectContentConflicts(localData, remoteData);
    
    // Strategy 4: Move-level comparison for active studies
    const moveConflicts = await this.detectMoveConflicts(localData, remoteData);

    // Combine results and determine conflict level
    return this.consolidateConflicts([
      timestampConflicts,
      structuralConflicts,
      contentConflicts,
      moveConflicts
    ]);
  }

  /**
   * Strategy 1: Timestamp-based conflict detection
   */
  detectTimestampConflicts(localData, remoteData, lastSyncTime) {
    const conflicts = {
      type: 'timestamp',
      hasConflicts: false,
      details: []
    };

    if (!lastSyncTime) {
      return conflicts; // First sync, no timestamp conflicts
    }

    const lastSync = new Date(lastSyncTime);
    
    // Check for studies modified after last sync in both locations
    const localModified = this.getModifiedStudies(localData.studies, lastSync);
    const remoteModified = this.getModifiedStudies(remoteData.studies, lastSync);
    
    // Find studies modified in both locations
    const conflictStudies = localModified.filter(local => 
      remoteModified.some(remote => remote.id === local.id)
    );

    if (conflictStudies.length > 0) {
      conflicts.hasConflicts = true;
      conflicts.details = conflictStudies.map(study => ({
        studyId: study.id,
        studyName: study.name,
        localModified: new Date(study.updated_at),
        remoteModified: new Date(remoteModified.find(r => r.id === study.id).updated_at),
        message: `Study "${study.name}" modified in both locations since last sync`
      }));
    }

    return conflicts;
  }

  /**
   * Strategy 2: Structural conflict detection (counts, organization)
   */
  detectStructuralConflicts(localData, remoteData) {
    const conflicts = {
      type: 'structural',
      hasConflicts: false,
      details: []
    };

    // Compare counts
    const localCounts = {
      studies: localData.studies?.length || 0,
      folders: localData.folders?.length || 0,
      tags: localData.tags?.length || 0
    };

    const remoteCounts = {
      studies: remoteData.studies?.length || 0,
      folders: remoteData.folders?.length || 0,
      tags: remoteData.tags?.length || 0
    };

    // Only flag as conflict if there are FEWER items locally than remote
    // (suggesting deletions while remote had additions)
    // Simple additions locally are NOT conflicts
    Object.keys(localCounts).forEach(key => {
      const localCount = localCounts[key];
      const remoteCount = remoteCounts[key];
      
      // Check for potential deletion conflicts
      // If remote has items that local doesn't, we need to check if they're actually missing
      if (remoteCount > localCount) {
        // Check if remote items are actually missing locally (deleted) vs just not synced yet
        const localIds = new Set((localData[key] || []).map(item => item.id));
        const remoteIds = new Set((remoteData[key] || []).map(item => item.id));
        
        const missingInLocal = Array.from(remoteIds).filter(id => !localIds.has(id));
        
        if (missingInLocal.length > 0) {
          // These items exist remotely but not locally - could be deletions or not synced
          // Only mark as conflict if we can't determine the cause
          conflicts.details.push({
            type: 'potential_deletion',
            category: key,
            local: localCount,
            remote: remoteCount,
            missingIds: missingInLocal,
            message: `Remote has ${missingInLocal.length} ${key} not found locally - may need sync`
          });
          // Don't mark as conflict yet - let timestamp check determine real conflicts
        }
      }
    });

    // Check for folder organization conflicts
    const folderConflicts = this.detectFolderOrganizationConflicts(
      localData.studies, 
      remoteData.studies,
      localData.folders,
      remoteData.folders
    );

    if (folderConflicts.length > 0) {
      conflicts.hasConflicts = true;
      conflicts.details.push(...folderConflicts);
    }

    return conflicts;
  }

  /**
   * Strategy 3: Content-based conflict detection using hashes
   */
  async detectContentConflicts(localData, remoteData) {
    const { databaseHashService } = await import('./DatabaseHashService.js');
    
    const conflicts = {
      type: 'content',
      hasConflicts: false,
      details: []
    };

    try {
      const localHashes = await databaseHashService.generateDatabaseHash(localData);
      const remoteHashes = await databaseHashService.generateDatabaseHash(remoteData);
      
      const hashComparison = databaseHashService.compareHashes(localHashes, remoteHashes);
      
      if (hashComparison.hasConflicts) {
        conflicts.hasConflicts = true;
        conflicts.details = hashComparison.details.map(detail => ({
          ...detail,
          message: `Content differs in ${detail.type}`
        }));
      }
    } catch (error) {
      console.warn('Content conflict detection failed:', error);
    }

    return conflicts;
  }

  /**
   * Strategy 4: Move-level conflict detection for precise comparison
   */
  async detectMoveConflicts(localData, remoteData) {
    const conflicts = {
      type: 'moves',
      hasConflicts: false,
      details: []
    };

    // Get recently modified studies for detailed comparison
    const recentlyModified = this.getRecentlyModifiedStudies([
      ...(localData.studies || []),
      ...(remoteData.studies || [])
    ]);

    for (const studyId of recentlyModified) {
      const localStudy = localData.studies?.find(s => s.id === studyId);
      const remoteStudy = remoteData.studies?.find(s => s.id === studyId);

      if (localStudy && remoteStudy) {
        const moveConflicts = await this.compareMoveStructures(
          studyId,
          localData.moves?.filter(m => m.study_id === studyId) || [],
          remoteData.moves?.filter(m => m.study_id === studyId) || [],
          localData.annotations?.filter(a => 
            localData.moves?.some(m => m.id === a.move_id && m.study_id === studyId)
          ) || [],
          remoteData.annotations?.filter(a => 
            remoteData.moves?.some(m => m.id === a.move_id && m.study_id === studyId)
          ) || []
        );

        if (moveConflicts.length > 0) {
          conflicts.hasConflicts = true;
          conflicts.details.push({
            studyId,
            studyName: localStudy.name,
            moveConflicts
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Compare move structures between local and remote for a specific study
   */
  async compareMoveStructures(studyId, localMoves, remoteMoves, localAnnotations, remoteAnnotations) {
    const conflicts = [];
    
    // Create FEN-based maps for comparison
    const localMoveMap = new Map(localMoves.map(m => [m.fen, m]));
    const remoteMoveMap = new Map(remoteMoves.map(m => [m.fen, m]));
    
    // Find move tree differences
    for (const [fen, localMove] of localMoveMap) {
      const remoteMove = remoteMoveMap.get(fen);
      
      if (!remoteMove) {
        conflicts.push({
          type: 'move_added_locally',
          fen,
          move: localMove.san,
          message: `Move ${localMove.san} exists only locally`
        });
      } else {
        // Compare move details
        const moveDiff = this.compareMovePrecisely(localMove, remoteMove, localAnnotations, remoteAnnotations);
        if (moveDiff.length > 0) {
          conflicts.push({
            type: 'move_modified',
            fen,
            move: localMove.san,
            differences: moveDiff,
            message: `Move ${localMove.san} has been modified`
          });
        }
      }
    }
    
    // Find remote-only moves
    for (const [fen, remoteMove] of remoteMoveMap) {
      if (!localMoveMap.has(fen)) {
        conflicts.push({
          type: 'move_added_remotely',
          fen,
          move: remoteMove.san,
          message: `Move ${remoteMove.san} exists only in cloud`
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Precise comparison of individual moves including arrows and annotations
   */
  compareMovePrecisely(localMove, remoteMove, localAnnotations, remoteAnnotations) {
    const differences = [];
    
    // Compare basic properties
    const basicFields = ['san', 'uci', 'is_main_line', 'is_initial_move', 'evaluation', 'comment'];
    basicFields.forEach(field => {
      if (localMove[field] !== remoteMove[field]) {
        differences.push({
          field,
          local: localMove[field],
          remote: remoteMove[field]
        });
      }
    });
    
    // Compare arrows with normalization
    const localArrows = this.normalizeArrows(localMove.arrows);
    const remoteArrows = this.normalizeArrows(remoteMove.arrows);
    
    if (JSON.stringify(localArrows) !== JSON.stringify(remoteArrows)) {
      differences.push({
        field: 'arrows',
        local: localArrows,
        remote: remoteArrows
      });
    }
    
    // Compare highlights
    const localHighlights = Array.isArray(localMove.highlights) ? 
      localMove.highlights.sort() : [];
    const remoteHighlights = Array.isArray(remoteMove.highlights) ? 
      remoteMove.highlights.sort() : [];
    
    if (JSON.stringify(localHighlights) !== JSON.stringify(remoteHighlights)) {
      differences.push({
        field: 'highlights',
        local: localHighlights,
        remote: remoteHighlights
      });
    }
    
    // Compare annotations
    const localMoveAnnotations = localAnnotations.filter(a => a.move_id === localMove.id);
    const remoteMoveAnnotations = remoteAnnotations.filter(a => a.move_id === remoteMove.id);
    
    if (localMoveAnnotations.length !== remoteMoveAnnotations.length ||
        !this.areAnnotationsEqual(localMoveAnnotations, remoteMoveAnnotations)) {
      differences.push({
        field: 'annotations',
        local: localMoveAnnotations,
        remote: remoteMoveAnnotations
      });
    }
    
    return differences;
  }

  /**
   * Utility methods
   */
  getModifiedStudies(studies, sinceDate) {
    return studies.filter(study => 
      new Date(study.updated_at) > sinceDate
    );
  }

  getRecentlyModifiedStudies(studies, daysSince = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysSince);
    
    return [...new Set(
      studies
        .filter(study => new Date(study.updated_at) > cutoff)
        .map(study => study.id)
    )];
  }

  normalizeArrows(arrows) {
    if (!Array.isArray(arrows)) return [];
    
    return arrows
      .map(arrow => ({
        from: arrow.from,
        to: arrow.to,
        color: arrow.color || '#22c55e'
      }))
      .sort((a, b) => {
        if (a.from !== b.from) return a.from.localeCompare(b.from);
        if (a.to !== b.to) return a.to.localeCompare(b.to);
        return a.color.localeCompare(b.color);
      });
  }

  areAnnotationsEqual(local, remote) {
    if (local.length !== remote.length) return false;
    
    const sortedLocal = [...local].sort((a, b) => a.type.localeCompare(b.type));
    const sortedRemote = [...remote].sort((a, b) => a.type.localeCompare(b.type));
    
    return JSON.stringify(sortedLocal) === JSON.stringify(sortedRemote);
  }

  detectFolderOrganizationConflicts(localStudies, remoteStudies, localFolders, remoteFolders) {
    const conflicts = [];
    
    // Check for studies in different folders
    const studyFolderMap = new Map();
    
    localStudies?.forEach(study => {
      studyFolderMap.set(study.id, { local: study.folder_id });
    });
    
    remoteStudies?.forEach(study => {
      const existing = studyFolderMap.get(study.id);
      if (existing) {
        existing.remote = study.folder_id;
      } else {
        studyFolderMap.set(study.id, { remote: study.folder_id });
      }
    });
    
    studyFolderMap.forEach((folders, studyId) => {
      if (folders.local !== undefined && 
          folders.remote !== undefined && 
          folders.local !== folders.remote) {
        const study = localStudies?.find(s => s.id === studyId) || 
                     remoteStudies?.find(s => s.id === studyId);
        
        conflicts.push({
          type: 'folder_assignment',
          studyId,
          studyName: study?.name || `Study ${studyId}`,
          localFolder: folders.local,
          remoteFolder: folders.remote,
          message: `Study "${study?.name}" is in different folders`
        });
      }
    });
    
    return conflicts;
  }

  /**
   * Consolidate conflicts from different strategies
   */
  consolidateConflicts(conflictResults) {
    const consolidated = {
      hasConflicts: false,
      level: 'none',
      details: [],
      resolutionSuggestions: []
    };

    let highestLevel = 0;
    const levelMap = { 'none': 0, 'metadata': 1, 'structure': 2, 'content': 3, 'moves': 4 };
    
    conflictResults.forEach(result => {
      if (result.hasConflicts) {
        consolidated.hasConflicts = true;
        consolidated.details.push(...result.details);
        
        const level = levelMap[result.type] || 0;
        if (level > highestLevel) {
          highestLevel = level;
        }
      }
    });

    // Set conflict level
    const levelNames = ['none', 'metadata', 'structure', 'content', 'moves'];
    consolidated.level = levelNames[highestLevel];

    // Generate resolution suggestions based on conflict level
    consolidated.resolutionSuggestions = this.generateResolutionSuggestions(consolidated);

    return consolidated;
  }

  /**
   * Generate smart resolution suggestions based on conflict types
   */
  generateResolutionSuggestions(conflicts) {
    const suggestions = [];
    
    if (conflicts.level === 'moves') {
      suggestions.push({
        type: 'manual_review',
        priority: 'high',
        message: 'Move-level conflicts detected. Manual review recommended.',
        action: 'Review each conflicting move in the conflict resolution interface'
      });
    } else if (conflicts.level === 'content') {
      suggestions.push({
        type: 'smart_merge',
        priority: 'medium',
        message: 'Content conflicts can potentially be auto-merged.',
        action: 'Try automatic merge with manual review of results'
      });
    } else if (conflicts.level === 'structure') {
      suggestions.push({
        type: 'quick_merge',
        priority: 'low',
        message: 'Structural conflicts are usually safe to auto-resolve.',
        action: 'Automatic resolution recommended'
      });
    }
    
    return suggestions;
  }
}

// Export singleton instance
export const conflictDetectionService = new ConflictDetectionService();
export default conflictDetectionService;