/**
 * Service for generating hierarchical hashes of database content
 * for granular conflict detection in chess studies
 */
class DatabaseHashService {
  constructor() {
    this.hashCache = new Map();
  }

  /**
   * Generate SHA-256 hash using Web Crypto API
   */
  async generateHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a comprehensive hash of the entire database
   */
  async generateDatabaseHash(dbData) {
    const { studies, folders, tags, moves, annotations } = dbData;
    
    const studiesHash = await this.generateStudiesHash(studies, moves, annotations);
    const foldersHash = await this.generateCollectionHash(folders, 'folder');
    const tagsHash = await this.generateCollectionHash(tags, 'tag');
    
    const combinedHash = await this.generateHash(
      studiesHash + foldersHash + tagsHash
    );
    
    return {
      database: combinedHash,
      studies: studiesHash,
      folders: foldersHash,
      tags: tagsHash,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate hash for all studies with their moves and annotations
   */
  async generateStudiesHash(studies, moves, annotations) {
    if (!studies || studies.length === 0) return 'empty-studies';
    
    const studyHashes = await Promise.all(
      studies.map(study => this.generateStudyHash(study, moves, annotations))
    );
    
    // Sort hashes to ensure consistent ordering
    studyHashes.sort();
    
    return await this.generateHash(studyHashes.join(''));
  }

  /**
   * Generate detailed hash for a single study including all its moves and annotations
   */
  async generateStudyHash(study, allMoves, allAnnotations) {
    // Study metadata
    const studyData = {
      id: study.id,
      name: study.name,
      color: study.color,
      initial_fen: study.initial_fen,
      initial_moves: study.initial_moves,
      initial_view_fen: study.initial_view_fen,
      starting_pgn: study.starting_pgn,
      folder_id: study.folder_id,
      position: study.position
    };
    
    // Get moves for this study
    const studyMoves = allMoves ? 
      allMoves.filter(move => move.study_id === study.id) : [];
    
    // Get annotations for study moves
    const moveIds = studyMoves.map(move => move.id);
    const studyAnnotations = allAnnotations ? 
      allAnnotations.filter(ann => moveIds.includes(ann.move_id)) : [];
    
    // Generate move tree hash
    const moveTreeHash = await this.generateMoveTreeHash(studyMoves, studyAnnotations);
    
    const studyHash = await this.generateHash(
      JSON.stringify(studyData) + moveTreeHash
    );
    
    return studyHash;
  }

  /**
   * Generate hash for move tree structure with arrows and annotations
   */
  async generateMoveTreeHash(moves, annotations) {
    if (!moves || moves.length === 0) return 'empty-moves';
    
    // Sort moves by move_number to ensure consistent ordering
    const sortedMoves = [...moves].sort((a, b) => a.move_number - b.move_number);
    
    const moveHashes = await Promise.all(sortedMoves.map(async (move) => {
      // Get annotations for this move
      const moveAnnotations = annotations.filter(ann => ann.move_id === move.id);
      
      const moveData = {
        fen: move.fen,
        san: move.san,
        uci: move.uci,
        move_number: move.move_number,
        parent_fen: move.parent_fen,
        is_main_line: move.is_main_line,
        is_initial_move: move.is_initial_move,
        evaluation: move.evaluation,
        comment: move.comment,
        arrows: this.normalizeArrows(move.arrows),
        highlights: move.highlights,
        annotations: moveAnnotations.map(ann => ({
          type: ann.type,
          content: ann.content,
          url: ann.url
        })).sort((a, b) => a.type.localeCompare(b.type))
      };
      
      return await this.generateHash(JSON.stringify(moveData));
    }));
    
    return await this.generateHash(moveHashes.join(''));
  }

  /**
   * Generate hash for a simple collection (folders, tags)
   */
  async generateCollectionHash(items, type) {
    if (!items || items.length === 0) return `empty-${type}s`;
    
    const sortedItems = [...items].sort((a, b) => a.id - b.id);
    const itemsString = JSON.stringify(sortedItems);
    
    return await this.generateHash(itemsString);
  }

  /**
   * Normalize arrows to ensure consistent comparison
   */
  normalizeArrows(arrows) {
    if (!arrows || !Array.isArray(arrows)) return [];
    
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

  /**
   * Compare two database hashes and identify conflicts
   */
  compareHashes(localHashes, remoteHashes) {
    const conflicts = {
      hasConflicts: false,
      studies: [],
      folders: false,
      tags: false,
      details: []
    };

    // Check overall database hash
    if (localHashes.database === remoteHashes.database) {
      return conflicts; // No conflicts
    }

    conflicts.hasConflicts = true;

    // Check studies
    if (localHashes.studies !== remoteHashes.studies) {
      conflicts.studies.push('Studies content differs');
      conflicts.details.push({
        type: 'studies',
        local: localHashes.studies,
        remote: remoteHashes.studies
      });
    }

    // Check folders
    if (localHashes.folders !== remoteHashes.folders) {
      conflicts.folders = true;
      conflicts.details.push({
        type: 'folders',
        local: localHashes.folders,
        remote: remoteHashes.folders
      });
    }

    // Check tags
    if (localHashes.tags !== remoteHashes.tags) {
      conflicts.tags = true;
      conflicts.details.push({
        type: 'tags',
        local: localHashes.tags,
        remote: remoteHashes.tags
      });
    }

    return conflicts;
  }

  /**
   * Generate study-specific conflict report
   */
  async generateStudyConflicts(localStudies, remoteStudies, localMoves, remoteMoves, localAnnotations, remoteAnnotations) {
    const conflicts = [];
    
    // Create maps for efficient lookup
    const remoteStudyMap = new Map(remoteStudies.map(s => [s.id, s]));
    const localStudyMap = new Map(localStudies.map(s => [s.id, s]));
    
    // Check each local study
    for (const localStudy of localStudies) {
      const remoteStudy = remoteStudyMap.get(localStudy.id);
      
      if (!remoteStudy) {
        conflicts.push({
          type: 'local_only',
          study: localStudy,
          message: `Study "${localStudy.name}" exists only locally`
        });
        continue;
      }
      
      // Generate hashes for detailed comparison
      const localHash = await this.generateStudyHash(localStudy, localMoves, localAnnotations);
      const remoteHash = await this.generateStudyHash(remoteStudy, remoteMoves, remoteAnnotations);
      
      if (localHash !== remoteHash) {
        conflicts.push({
          type: 'modified',
          study: localStudy,
          remoteStudy: remoteStudy,
          localHash,
          remoteHash,
          message: `Study "${localStudy.name}" has been modified in both locations`,
          details: await this.generateDetailedStudyDiff(localStudy, remoteStudy, localMoves, remoteMoves, localAnnotations, remoteAnnotations)
        });
      }
    }
    
    // Check for remote-only studies
    for (const remoteStudy of remoteStudies) {
      if (!localStudyMap.has(remoteStudy.id)) {
        conflicts.push({
          type: 'remote_only',
          study: remoteStudy,
          message: `Study "${remoteStudy.name}" exists only in cloud`
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Generate detailed diff for a specific study
   */
  async generateDetailedStudyDiff(localStudy, remoteStudy, localMoves, remoteMoves, localAnnotations, remoteAnnotations) {
    const diff = {
      metadata: {},
      moves: {},
      annotations: {}
    };
    
    // Compare metadata
    const metadataFields = ['name', 'color', 'initial_fen', 'initial_moves', 'initial_view_fen', 'starting_pgn', 'folder_id', 'position'];
    for (const field of metadataFields) {
      if (localStudy[field] !== remoteStudy[field]) {
        diff.metadata[field] = {
          local: localStudy[field],
          remote: remoteStudy[field]
        };
      }
    }
    
    // Compare moves
    const localStudyMoves = localMoves.filter(m => m.study_id === localStudy.id);
    const remoteStudyMoves = remoteMoves.filter(m => m.study_id === remoteStudy.id);
    
    const localMoveMap = new Map(localStudyMoves.map(m => [m.fen, m]));
    const remoteMoveMap = new Map(remoteStudyMoves.map(m => [m.fen, m]));
    
    // Find move differences
    for (const [fen, localMove] of localMoveMap) {
      const remoteMove = remoteMoveMap.get(fen);
      
      if (!remoteMove) {
        diff.moves[fen] = {
          type: 'local_only',
          move: localMove
        };
      } else {
        const moveDiff = this.compareMove(localMove, remoteMove);
        if (Object.keys(moveDiff).length > 0) {
          diff.moves[fen] = {
            type: 'modified',
            differences: moveDiff
          };
        }
      }
    }
    
    for (const [fen, remoteMove] of remoteMoveMap) {
      if (!localMoveMap.has(fen)) {
        diff.moves[fen] = {
          type: 'remote_only',
          move: remoteMove
        };
      }
    }
    
    return diff;
  }

  /**
   * Compare individual moves for differences
   */
  compareMove(localMove, remoteMove) {
    const diff = {};
    const fields = ['san', 'uci', 'is_main_line', 'is_initial_move', 'evaluation', 'comment', 'arrows', 'highlights'];
    
    for (const field of fields) {
      let localValue = localMove[field];
      let remoteValue = remoteMove[field];
      
      // Special handling for arrows
      if (field === 'arrows') {
        localValue = this.normalizeArrows(localValue);
        remoteValue = this.normalizeArrows(remoteValue);
      }
      
      if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
        diff[field] = {
          local: localValue,
          remote: remoteValue
        };
      }
    }
    
    return diff;
  }

  /**
   * Clear hash cache
   */
  clearCache() {
    this.hashCache.clear();
  }
}

// Export singleton instance
export const databaseHashService = new DatabaseHashService();
export default databaseHashService;