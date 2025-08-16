import { firestoreService } from '../services/FirestoreService.js';
import { 
  localUserStudy, 
  localUserStudyMove, 
  localMoveAnnotation, 
  localStudyTag, 
  localStudyTagsMapping, 
  localStudyFolder,
  checkPositionInStudies as localCheckPositionInStudies,
  getStudyPositions as localGetStudyPositions,
  getAllStudyPositionsMap as localGetAllStudyPositionsMap
} from './localStorageEntities.js';
import { normalizeFen } from '../utils/chessUtils.js';
import { firebaseAuth } from '../services/FirebaseAuth.js';

// Base class for Firestore entities - provides compatibility with old SQLite interface
class BaseFirestoreModel {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  // Create a new document
  async create(data) {
    const methodName = `create${this.collectionName.slice(0, -1).charAt(0).toUpperCase()}${this.collectionName.slice(0, -1).slice(1)}`;
    
    if (typeof firestoreService[methodName] === 'function') {
      return await firestoreService[methodName](this.transformToFirestore(data));
    }
    throw new Error(`Method ${methodName} not implemented in FirestoreService`);
  }

  // Get all documents with optional filtering and ordering
  async list(orderField = 'createdAt', limitCount = null) {
    const queryOptions = {};
    
    if (orderField) {
      const direction = orderField.startsWith('-') ? 'desc' : 'asc';
      const field = orderField.startsWith('-') ? orderField.slice(1) : orderField;
      queryOptions.orderBy = [field, direction];
    }
    
    if (limitCount) {
      queryOptions.limit = limitCount;
    }

    const methodName = `get${this.collectionName.charAt(0).toUpperCase()}${this.collectionName.slice(1)}`;
    
    if (typeof firestoreService[methodName] === 'function') {
      const results = await firestoreService[methodName](queryOptions);
      return results.map(doc => this.transformFromFirestore(doc));
    }
    throw new Error(`Method ${methodName} not implemented in FirestoreService`);
  }

  // Filter documents by conditions
  async filter(conditions = {}, orderField = 'createdAt', limitCount = null) {
    const queryOptions = {};
    
    if (Object.keys(conditions).length > 0) {
      queryOptions.where = Object.entries(conditions).map(([field, value]) => [
        this.mapFieldToFirestore(field), '==', value
      ]);
    }
    
    if (orderField) {
      const direction = orderField.startsWith('-') ? 'desc' : 'asc';
      const field = orderField.startsWith('-') ? orderField.slice(1) : orderField;
      queryOptions.orderBy = [this.mapFieldToFirestore(field), direction];
    }
    
    if (limitCount) {
      queryOptions.limit = limitCount;
    }

    const methodName = `get${this.collectionName.charAt(0).toUpperCase()}${this.collectionName.slice(1)}`;
    
    if (typeof firestoreService[methodName] === 'function') {
      const results = await firestoreService[methodName](queryOptions);
      return results.map(doc => this.transformFromFirestore(doc));
    }
    throw new Error(`Method ${methodName} not implemented in FirestoreService`);
  }

  // Update a document
  async update(id, data) {
    const methodName = `update${this.collectionName.slice(0, -1).charAt(0).toUpperCase()}${this.collectionName.slice(0, -1).slice(1)}`;
    
    if (typeof firestoreService[methodName] === 'function') {
      return await firestoreService[methodName](id, this.transformToFirestore(data));
    }
    throw new Error(`Method ${methodName} not implemented in FirestoreService`);
  }

  // Delete a document
  async delete(id) {
    const methodName = `delete${this.collectionName.slice(0, -1).charAt(0).toUpperCase()}${this.collectionName.slice(0, -1).slice(1)}`;
    
    if (typeof firestoreService[methodName] === 'function') {
      return await firestoreService[methodName](id);
    }
    throw new Error(`Method ${methodName} not implemented in FirestoreService`);
  }

  // Transform data from SQLite format to Firestore format
  transformToFirestore(data) {
    const transformed = { ...data };
    
    // Map field names
    Object.keys(transformed).forEach(key => {
      const firestoreKey = this.mapFieldToFirestore(key);
      if (firestoreKey !== key) {
        transformed[firestoreKey] = transformed[key];
        delete transformed[key];
      }
    });

    return transformed;
  }

  // Transform data from Firestore format to SQLite format (for compatibility)
  transformFromFirestore(data) {
    const transformed = { ...data };
    
    // Map field names back
    Object.keys(transformed).forEach(key => {
      const sqliteKey = this.mapFieldFromFirestore(key);
      if (sqliteKey !== key) {
        transformed[sqliteKey] = transformed[key];
        delete transformed[key];
      }
    });

    return transformed;
  }

  // Map SQLite field names to Firestore field names
  mapFieldToFirestore(field) {
    const mapping = {
      'study_id': 'studyId',
      'tag_id': 'tagId',
      'move_id': 'moveId',
      'folder_id': 'folderId',
      'parent_fen': 'parentFen',
      'move_number': 'moveNumber',
      'is_main_line': 'isMainLine',
      'is_initial_move': 'isInitialMove',
      'initial_fen': 'initialFen',
      'initial_moves': 'initialMoves',
      'initial_view_fen': 'initialViewFen',
      'starting_pgn': 'startingPgn',
      'created_at': 'createdAt',
      'updated_at': 'updatedAt'
    };
    return mapping[field] || field;
  }

  // Map Firestore field names back to SQLite field names
  mapFieldFromFirestore(field) {
    const mapping = {
      'studyId': 'study_id',
      'tagId': 'tag_id',
      'moveId': 'move_id',
      'folderId': 'folder_id',
      'parentFen': 'parent_fen',
      'moveNumber': 'move_number',
      'isMainLine': 'is_main_line',
      'isInitialMove': 'is_initial_move',
      'initialFen': 'initial_fen',
      'initialMoves': 'initial_moves',
      'initialViewFen': 'initial_view_fen',
      'startingPgn': 'starting_pgn',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at'
    };
    return mapping[field] || field;
  }
}

// Helper to check if user is signed in with Google
const isGoogleSignedIn = () => {
  return firebaseAuth.getCurrentUser() !== null;
};

// UserStudy model for managing user's repertoire
export class UserStudy extends BaseFirestoreModel {
  constructor() {
    super('user_studies');
  }

  async create(data) {
    if (isGoogleSignedIn()) {
      // Use Firestore if signed in with Google
      if (typeof data.initial_moves === 'string') {
        try {
          data.initial_moves = JSON.parse(data.initial_moves);
        } catch (e) {
          data.initial_moves = [];
        }
      }
      return await firestoreService.createStudy(this.transformToFirestore(data));
    } else {
      // Use localStorage if not signed in
      return await localUserStudy.create(data);
    }
  }

  async getByUsername(username) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudies({
        orderBy: ['updatedAt', 'desc']
      });
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await localUserStudy.getByUsername(username);
    }
  }

  async getByName(username, name) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudies({
        where: [['name', '==', name]]
      });
      
      if (results.length > 0) {
        return this.transformFromFirestore(results[0]);
      }
      return null;
    } else {
      return await localUserStudy.getByName(username, name);
    }
  }

  async getByFolder(folderId) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudies({
        where: [['folderId', '==', folderId]],
        orderBy: ['position', 'asc']
      });
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await localUserStudy.getByFolder(folderId);
    }
  }

  async getUnfolderedByUsername(username) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudies({
        where: [['folderId', '==', null]],
        orderBy: ['position', 'asc']
      });
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await localUserStudy.getUnfolderedByUsername(username);
    }
  }

  async update(id, data) {
    if (isGoogleSignedIn()) {
      return await firestoreService.updateStudy(id, this.transformToFirestore(data));
    } else {
      return await localUserStudy.update(id, data);
    }
  }

  async delete(id) {
    if (isGoogleSignedIn()) {
      return await firestoreService.deleteStudy(id);
    } else {
      return await localUserStudy.delete(id);
    }
  }

  async updatePositions(studyPositions) {
    if (isGoogleSignedIn()) {
      for (const { id, position, folderId } of studyPositions) {
        try {
          await firestoreService.updateStudy(id, {
            position: position,
            folderId: folderId || null
          });
        } catch (error) {
          console.error('Error updating study position:', error);
        }
      }
    } else {
      await localUserStudy.updatePositions(studyPositions);
    }
  }
}

// UserStudyMove model for individual moves in a study
export class UserStudyMove extends BaseFirestoreModel {
  constructor() {
    super('user_study_moves');
  }

  async create(data) {
    // Ensure arrays are preserved (not converted to JSON strings)
    const processedData = {
      ...data,
      arrows: Array.isArray(data.arrows) ? data.arrows : (data.arrows ? JSON.parse(data.arrows) : []),
      highlights: Array.isArray(data.highlights) ? data.highlights : (data.highlights ? JSON.parse(data.highlights) : [])
    };
    return await firestoreService.createStudyMove(this.transformToFirestore(processedData));
  }

  async getByStudyId(studyId) {
    return await firestoreService.getStudyMoves(studyId);
  }

  async getByFen(fen) {
    const results = await firestoreService.getStudyMoves();
    // Filter by FEN on the client side since Firestore doesn't have a direct query method for this
    return results.filter(move => move.fen === fen);
  }

  async getChildren(studyId, parentFen) {
    const allMoves = await firestoreService.getStudyMoves(studyId);
    return allMoves.filter(move => move.parentFen === parentFen).sort((a, b) => a.moveNumber - b.moveNumber);
  }
}

// MoveAnnotation model for links and notes
export class MoveAnnotation extends BaseFirestoreModel {
  constructor() {
    super('move_annotations');
  }

  async create(data) {
    return await firestoreService.createMoveAnnotation(this.transformToFirestore(data));
  }

  async getByMoveId(moveId) {
    return await firestoreService.getMoveAnnotations(moveId);
  }

  async getByType(moveId, type) {
    const annotations = await firestoreService.getMoveAnnotations(moveId);
    return annotations.filter(annotation => annotation.type === type);
  }

  async deleteByMoveId(moveId) {
    const annotations = await firestoreService.getMoveAnnotations(moveId);
    for (const annotation of annotations) {
      await firestoreService.deleteMoveAnnotation(annotation.id);
    }
    return { success: true };
  }
}

// StudyTag model for managing study tags
export class StudyTag extends BaseFirestoreModel {
  constructor() {
    super('study_tags');
  }

  async create(data) {
    return await firestoreService.createStudyTag(data);
  }

  async getAll() {
    return await firestoreService.getStudyTags();
  }

  async list(orderField = 'name') {
    return await firestoreService.getStudyTags();
  }

  async delete(id) {
    return await firestoreService.deleteStudyTag(id);
  }

  async createDefault() {
    return await firestoreService.initializeDefaultTags();
  }
}

// StudyFolder model for organizing studies in folders
export class StudyFolder extends BaseFirestoreModel {
  constructor() {
    super('study_folders');
  }

  async create(data) {
    return await firestoreService.createStudyFolder(data);
  }

  async getByUsername(username) {
    // In Firestore, folders are already user-scoped
    return await firestoreService.getStudyFolders();
  }

  async updatePositions(folderPositions) {
    for (const { id, position } of folderPositions) {
      try {
        await firestoreService.updateStudyFolder(id, { position });
      } catch (error) {
        console.error('Error updating folder position:', error);
      }
    }
  }

  async delete(id) {
    return await firestoreService.deleteStudyFolder(id);
  }
}

// StudyTagsMapping model for managing study-tag relationships
export class StudyTagsMapping extends BaseFirestoreModel {
  constructor() {
    super('study_tags_mapping');
  }

  async getTagsByStudyId(studyId) {
    // Get tag mappings for the study
    const mappings = await firestoreService.getStudyTagsMappings(studyId);
    
    // Get all tags
    const allTags = await firestoreService.getStudyTags();
    
    // Filter tags that are mapped to this study
    const tagIds = mappings.map(mapping => mapping.tagId);
    return allTags.filter(tag => tagIds.includes(tag.id));
  }

  async addTagToStudy(studyId, tagId) {
    return await firestoreService.addTagToStudy(studyId, tagId);
  }

  async removeTagFromStudy(studyId, tagId) {
    return await firestoreService.removeTagFromStudy(studyId, tagId);
  }

  async create(data) {
    return await firestoreService.addTagToStudy(data.study_id, data.tag_id);
  }

  async filter(conditions) {
    if (conditions.study_id) {
      return await firestoreService.getStudyTagsMappings(conditions.study_id);
    }
    // For other filters, we'd need to implement a more generic query method
    return [];
  }

  async delete(id) {
    // This is tricky since we don't have a direct delete mapping by ID method
    // We'll need to implement this if it's actually used
    console.warn('StudyTagsMapping.delete(id) not implemented - use removeTagFromStudy instead');
    return { success: false };
  }
}

// Export singleton instances (compatible with existing code)
export const userStudy = new UserStudy();
export const userStudyMove = new UserStudyMove();
export const moveAnnotation = new MoveAnnotation();
export const studyTag = new StudyTag();
export const studyTagsMapping = new StudyTagsMapping();
export const studyFolder = new StudyFolder();

// Legacy exports for backward compatibility during transition
export const UserOpening = UserStudy;
export const UserOpeningMove = UserStudyMove;
export const userOpening = userStudy;
export const userOpeningMove = userStudyMove;

// Database readiness functions (always ready with Firestore)
export const isDatabaseReady = () => true;
export const waitForDatabase = async () => true;

// Helper function to check if a FEN position exists in user's studies
export const checkPositionInStudies = async (fen, username) => {
  try {
    // Normalize the input FEN for comparison
    const normalizedInputFen = normalizeFen(fen);
    
    // Get all user studies
    const studies = await userStudy.getByUsername(username);
    const matchingStudies = [];
    
    for (const study of studies) {
      // Get all moves for this study
      const moves = await userStudyMove.getByStudyId(study.id);
      
      // Check if any move matches the normalized FEN
      const hasPosition = moves.some(move => normalizeFen(move.fen) === normalizedInputFen);
      
      if (hasPosition) {
        matchingStudies.push({
          id: study.id,
          name: study.name,
          color: study.color,
          tags: study.tags || []
        });
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
    // Get all user studies
    const studies = await userStudy.getByUsername(username);
    if (studies.length === 0) return new Map();
    
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