import { BaseModel, isDatabaseReady, waitForDatabase } from './database';
import { normalizeFen } from '../utils/chessUtils';

// Get database reference for complex queries
let db = null;
try {
  // Use dynamic import to get database instance
  const { default: initSqlJs } = await import('sql.js');
  // We'll access the global database instance
  setTimeout(() => {
    const dbData = localStorage.getItem('chesscope_db');
    if (dbData) {
      const uint8Array = new Uint8Array(JSON.parse(dbData));
      initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      }).then(SQL => {
        db = new SQL.Database(uint8Array);
      });
    }
  }, 100);
} catch (error) {
  console.warn('Could not setup database reference:', error);
}

// UserStudy model for managing user's repertoire
export class UserStudy extends BaseModel {
  constructor() {
    super('user_studies', [
      'username', 'name', 'color', 'initial_fen', 
      'initial_moves', 'starting_pgn'
    ]);
  }

  async create(data) {
    // Ensure initial_moves is stored as JSON string
    if (Array.isArray(data.initial_moves)) {
      data.initial_moves = JSON.stringify(data.initial_moves);
    }
    return super.create(data);
  }

  async getByUsername(username) {
    // Check if database is ready, if not wait for it
    if (!isDatabaseReady()) {
      try {
        await waitForDatabase(5000); // Wait max 5 seconds
      } catch (error) {
        console.warn('Database not ready for getByUsername:', error);
        return [];
      }
    }
    
    return this.filter({ username }, '-updated_at');
  }

  async getByName(username, name) {
    const results = await this.filter({ username, name });
    return results.length > 0 ? results[0] : null;
  }

  transformRow(row) {
    const transformed = super.transformRow(row);
    
    // Parse JSON fields
    if (transformed.initial_moves && typeof transformed.initial_moves === 'string') {
      try {
        transformed.initial_moves = JSON.parse(transformed.initial_moves);
      } catch (e) {
        transformed.initial_moves = [];
      }
    }
    
    return transformed;
  }
}

// UserStudyMove model for individual moves in a study
export class UserStudyMove extends BaseModel {
  constructor() {
    super('user_study_moves', [
      'study_id', 'fen', 'san', 'uci', 'move_number',
      'parent_fen', 'is_main_line', 'evaluation', 'comment',
      'arrows', 'highlights'
    ]);
  }

  async create(data) {
    // Ensure JSON fields are stored as strings
    if (Array.isArray(data.arrows)) {
      data.arrows = JSON.stringify(data.arrows);
    }
    if (Array.isArray(data.highlights)) {
      data.highlights = JSON.stringify(data.highlights);
    }
    return super.create(data);
  }

  async getByStudyId(studyId) {
    return this.filter({ study_id: studyId }, 'move_number');
  }

  async getByFen(fen) {
    return this.filter({ fen });
  }

  async getChildren(studyId, parentFen) {
    return this.filter({ study_id: studyId, parent_fen: parentFen }, 'move_number');
  }

  transformRow(row) {
    const transformed = super.transformRow(row);
    
    // Parse JSON fields
    if (transformed.arrows && typeof transformed.arrows === 'string') {
      try {
        transformed.arrows = JSON.parse(transformed.arrows);
      } catch (e) {
        transformed.arrows = [];
      }
    }
    
    if (transformed.highlights && typeof transformed.highlights === 'string') {
      try {
        transformed.highlights = JSON.parse(transformed.highlights);
      } catch (e) {
        transformed.highlights = [];
      }
    }
    
    return transformed;
  }
}

// MoveAnnotation model for links and notes
export class MoveAnnotation extends BaseModel {
  constructor() {
    super('move_annotations', [
      'move_id', 'type', 'content', 'url'
    ]);
  }

  async getByMoveId(moveId) {
    return this.filter({ move_id: moveId }, '-created_at');
  }

  async getByType(moveId, type) {
    return this.filter({ move_id: moveId, type });
  }

  async deleteByMoveId(moveId) {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const query = 'DELETE FROM move_annotations WHERE move_id = ?';
    
    try {
      const stmt = db.prepare(query);
      stmt.run([moveId]);
      stmt.free();
    } catch (error) {
      console.error('Error deleting annotations by move ID:', error);
      throw error;
    }
  }
}

// StudyTag model for managing study tags
export class StudyTag extends BaseModel {
  constructor() {
    super('study_tags', ['name', 'color']);
  }

  async getAll() {
    return this.list('name');
  }

  async delete(id) {
    console.log(`🏷️ StudyTag.delete: Starting deletion of tag id ${id}`);
    
    try {
      // First, remove all mappings that reference this tag using the mapping model
      console.log(`🔗 StudyTag.delete: Removing tag mappings for tag id ${id}`);
      
      // Get all mappings for this tag and delete them
      const mappings = await studyTagsMapping.filter({ tag_id: id });
      console.log(`🔗 StudyTag.delete: Found ${mappings.length} mappings to delete`);
      
      for (const mapping of mappings) {
        await studyTagsMapping.delete(mapping.id);
      }
      console.log(`🔗 StudyTag.delete: Removed ${mappings.length} tag mappings`);
      
      // Then delete the tag itself using parent method
      console.log(`🏷️ StudyTag.delete: Calling parent delete method`);
      const result = await super.delete(id);
      console.log(`✅ StudyTag.delete: Tag deletion completed successfully`);
      
      return result;
    } catch (error) {
      console.error('Error in StudyTag.delete:', error);
      throw error;
    }
  }

  async createDefault() {
    const defaultTags = [
      { name: 'Opening', color: '#22c55e' },
      { name: 'Middlegame', color: '#3b82f6' },
      { name: 'Endgame', color: '#f59e0b' },
      { name: 'Tactics', color: '#ef4444' },
      { name: 'Strategy', color: '#8b5cf6' },
      { name: 'Defense', color: '#06b6d4' }
    ];

    for (const tag of defaultTags) {
      try {
        await this.create(tag);
      } catch (error) {
        // Tag might already exist, ignore
        if (!error.message.includes('UNIQUE constraint failed')) {
          console.error('Error creating default tag:', error);
        }
      }
    }
  }
}

// StudyTagsMapping model for managing study-tag relationships
export class StudyTagsMapping extends BaseModel {
  constructor() {
    super('study_tags_mapping', ['study_id', 'tag_id']);
  }

  async getTagsByStudyId(studyId) {
    // Wait for database if needed
    if (!isDatabaseReady()) {
      try {
        await waitForDatabase(5000);
      } catch (error) {
        console.warn('Database not ready for tags:', error);
        return [];
      }
    }

    // Try to get database instance from the global scope
    const dbModule = await import('./database.js');
    const dbInstance = dbModule.getDb() || window.db;
    
    if (!dbInstance) {
      console.warn('No database instance available for tags query');
      return [];
    }

    const query = `
      SELECT st.id, st.name, st.color 
      FROM study_tags st
      JOIN study_tags_mapping stm ON st.id = stm.tag_id
      WHERE stm.study_id = ?
      ORDER BY st.name
    `;
    
    try {
      const stmt = dbInstance.prepare(query);
      stmt.bind([studyId]);
      const rows = [];
      
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      
      stmt.free();
      return rows;
    } catch (error) {
      console.error('Error getting tags by study ID:', error);
      return [];
    }
  }

  async addTagToStudy(studyId, tagId) {
    try {
      await this.create({ study_id: studyId, tag_id: tagId });
    } catch (error) {
      // Tag might already be assigned, ignore
      if (!error.message.includes('UNIQUE constraint failed')) {
        throw error;
      }
    }
  }

  async removeTagFromStudy(studyId, tagId) {
    // Wait for database if needed
    if (!isDatabaseReady()) {
      try {
        await waitForDatabase(5000);
      } catch (error) {
        console.warn('Database not ready for tag removal:', error);
        return;
      }
    }

    // Try to get database instance from the global scope
    const dbModule = await import('./database.js');
    const dbInstance = dbModule.getDb() || window.db;
    
    if (!dbInstance) {
      console.warn('No database instance available for tag removal');
      return;
    }

    const query = 'DELETE FROM study_tags_mapping WHERE study_id = ? AND tag_id = ?';
    
    try {
      const stmt = dbInstance.prepare(query);
      stmt.run([studyId, tagId]);
      stmt.free();
    } catch (error) {
      console.error('Error removing tag from study:', error);
      throw error;
    }
  }
}

// Export singleton instances
export const userStudy = new UserStudy();
export const userStudyMove = new UserStudyMove();
export const moveAnnotation = new MoveAnnotation();
export const studyTag = new StudyTag();
export const studyTagsMapping = new StudyTagsMapping();

// Legacy exports for backward compatibility during transition
export const UserOpening = UserStudy;
export const UserOpeningMove = UserStudyMove;
export const userOpening = userStudy;
export const userOpeningMove = userStudyMove;

// Re-export database readiness functions for convenience
export { isDatabaseReady, waitForDatabase } from './database';

// Helper function to check if a FEN position exists in user's studies
export const checkPositionInStudies = async (fen, username) => {
  try {
    // Check if database is ready, if not wait for it
    if (!isDatabaseReady()) {
      try {
        await waitForDatabase(5000); // Wait max 5 seconds
      } catch (error) {
        console.warn('Database not ready for position check:', error);
        return [];
      }
    }
    
    // Normalize the input FEN for comparison
    const normalizedInputFen = normalizeFen(fen);
    
    // Get all user studies
    const studies = await userStudy.getByUsername(username);
    const studyIds = studies.map(s => s.id);
    
    if (studyIds.length === 0) return [];
    
    // Check each study for this position
    const matchingStudies = [];
    
    for (const studyId of studyIds) {
      // Get all moves for this study
      const moves = await userStudyMove.getByStudyId(studyId);
      
      // Check if any move matches the normalized FEN
      const hasPosition = moves.some(move => normalizeFen(move.fen) === normalizedInputFen);
      
      if (hasPosition) {
        const study = studies.find(s => s.id === studyId);
        if (study) {
          matchingStudies.push({
            id: study.id,
            name: study.name,
            color: study.color,
            tags: study.tags || []
          });
        }
      }
    }
    
    return matchingStudies;
  } catch (error) {
    console.error('Error checking position in studies:', error);
    return [];
  }
};

// Legacy function for backward compatibility
export const checkPositionInOpenings = checkPositionInStudies;

// Helper to get all positions for a specific study
export const getStudyPositions = async (studyId) => {
  try {
    // Check if database is ready, if not wait for it
    if (!isDatabaseReady()) {
      try {
        await waitForDatabase(5000); // Wait max 5 seconds
      } catch (error) {
        console.warn('Database not ready for study positions:', error);
        return [];
      }
    }
    
    const moves = await userStudyMove.getByStudyId(studyId);
    return moves.map(move => move.fen);
  } catch (error) {
    console.error('Error getting study positions:', error);
    return [];
  }
};

// Legacy function for backward compatibility
export const getOpeningPositions = getStudyPositions;

// Helper to get all FEN-to-study mappings for a user (optimized for performance graph)
export const getAllStudyPositionsMap = async (username) => {
  try {
    // Check if database is ready, if not wait for it
    if (!isDatabaseReady()) {
      try {
        await waitForDatabase(5000); // Wait max 5 seconds
      } catch (error) {
        console.warn('Database not ready for study positions map:', error);
        return new Map();
      }
    }
    
    // Get all user studies
    const studies = await userStudy.getByUsername(username);
    if (studies.length === 0) return new Map();
    
    // Get all moves for all studies in one efficient query
    const studyIds = studies.map(s => s.id);
    const fenToStudiesMap = new Map();
    
    for (const study of studies) {
      const moves = await userStudyMove.getByStudyId(study.id);
      
      for (const move of moves) {
        // Normalize FEN for consistent comparison
        const normalizedFen = normalizeFen(move.fen);
        
        if (!fenToStudiesMap.has(normalizedFen)) {
          fenToStudiesMap.set(normalizedFen, []);
        }
        
        // Only add if not already in the array (avoid duplicates)
        const existingStudies = fenToStudiesMap.get(normalizedFen);
        if (!existingStudies.some(s => s.id === study.id)) {
          existingStudies.push({
            id: study.id,
            name: study.name,
            color: study.color,
            tags: study.tags || []
          });
        }
      }
    }
    
    return fenToStudiesMap;
  } catch (error) {
    console.error('Error getting all study positions map:', error);
    return new Map();
  }
};

// Legacy function for backward compatibility
export const getAllOpeningPositionsMap = getAllStudyPositionsMap;