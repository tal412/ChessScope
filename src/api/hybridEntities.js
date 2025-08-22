// Hybrid entities that automatically choose between Firestore and localStorage
// based on Google authentication status

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
import { firebaseAuth } from '../services/FirebaseAuth.js';

// Helper to check if user is signed in with Google
const isGoogleSignedIn = () => {
  return firebaseAuth.getCurrentUser() !== null;
};

// Base hybrid class that routes to the appropriate backend
class HybridModel {
  constructor(localModel, firestorePrefix) {
    this.localModel = localModel;
    this.firestorePrefix = firestorePrefix;
  }

  // Transform data for Firestore compatibility
  transformToFirestore(data) {
    const transformed = { ...data };
    
    // Map field names for Firestore
    const mapping = {
      'study_id': 'studyId',
      'tag_id': 'tagId',
      'move_id': 'moveId',
      'folder_id': 'folderId',
      'parent_fen': 'parentFen',
      'move_number': 'moveNumber',
      'is_main_line': 'isMainLine',
      'initial_fen': 'initialFen',
      'initial_view_fen': 'initialViewFen',
      'created_at': 'createdAt',
      'updated_at': 'updatedAt'
    };
    
    Object.keys(transformed).forEach(key => {
      const firestoreKey = mapping[key];
      if (firestoreKey && firestoreKey !== key) {
        transformed[firestoreKey] = transformed[key];
        delete transformed[key];
      }
    });

    return transformed;
  }

  // Transform data from Firestore to local format
  transformFromFirestore(data) {
    const transformed = { ...data };
    
    const mapping = {
      'studyId': 'study_id',
      'tagId': 'tag_id', 
      'moveId': 'move_id',
      'folderId': 'folder_id',
      'parentFen': 'parent_fen',
      'moveNumber': 'move_number',
      'isMainLine': 'is_main_line',
      'initialFen': 'initial_fen',
      'initialViewFen': 'initial_view_fen',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at'
    };
    
    Object.keys(transformed).forEach(key => {
      const localKey = mapping[key];
      if (localKey && localKey !== key) {
        transformed[localKey] = transformed[key];
        delete transformed[key];
      }
    });

    return transformed;
  }
}

// UserStudy hybrid model
export class UserStudy extends HybridModel {
  constructor() {
    super(localUserStudy, 'Study');
  }

  async create(data) {
    if (isGoogleSignedIn()) {
      if (typeof data.initial_moves === 'string') {
        try {
          data.initial_moves = JSON.parse(data.initial_moves);
        } catch (e) {
          data.initial_moves = [];
        }
      }
      const result = await firestoreService.createStudy(this.transformToFirestore(data));
      return this.transformFromFirestore(result);
    } else {
      return await this.localModel.create(data);
    }
  }

  async getById(id) {
    console.log('[UserStudy.getById] Called with id:', id, 'type:', typeof id);
    console.log('[UserStudy.getById] Is Google signed in?', isGoogleSignedIn());
    
    if (isGoogleSignedIn()) {
      console.log('[UserStudy.getById] Using Firestore backend');
      const result = await firestoreService.getStudyById(id);
      console.log('[UserStudy.getById] Firestore result:', result);
      const transformed = result ? this.transformFromFirestore(result) : null;
      console.log('[UserStudy.getById] Transformed result:', transformed);
      return transformed;
    } else {
      console.log('[UserStudy.getById] Using local storage backend');
      const result = await this.localModel.getById(id);
      console.log('[UserStudy.getById] Local storage result:', result);
      return result;
    }
  }

  async getByUsername(username) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudies({
        orderBy: ['updatedAt', 'desc']
      });
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await this.localModel.getByUsername(username);
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
      return await this.localModel.getByName(username, name);
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
      return await this.localModel.getByFolder(folderId);
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
      return await this.localModel.getUnfolderedByUsername(username);
    }
  }

  async update(id, data) {
    if (isGoogleSignedIn()) {
      const result = await firestoreService.updateStudy(id, this.transformToFirestore(data));
      return this.transformFromFirestore(result);
    } else {
      return await this.localModel.update(id, data);
    }
  }

  async delete(id) {
    if (isGoogleSignedIn()) {
      return await firestoreService.deleteStudy(id);
    } else {
      return await this.localModel.delete(id);
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
      await this.localModel.updatePositions(studyPositions);
    }
  }
}

// UserStudyMove hybrid model  
export class UserStudyMove extends HybridModel {
  constructor() {
    super(localUserStudyMove, 'StudyMove');
  }

  async create(data) {
    if (isGoogleSignedIn()) {
      const processedData = {
        ...data,
        arrows: Array.isArray(data.arrows) ? data.arrows : [],
        highlights: Array.isArray(data.highlights) ? data.highlights : []
      };
      const result = await firestoreService.createStudyMove(this.transformToFirestore(processedData));
      return this.transformFromFirestore(result);
    } else {
      return await this.localModel.create(data);
    }
  }

  async getByStudyId(studyId) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudyMoves(studyId);
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await this.localModel.getByStudyId(studyId);
    }
  }

  async getByFen(fen) {
    if (isGoogleSignedIn()) {
      // This would require a more complex Firestore query
      // For now, delegate to local implementation
      return await this.localModel.getByFen(fen);
    } else {
      return await this.localModel.getByFen(fen);
    }
  }

  async getChildren(studyId, parentFen) {
    if (isGoogleSignedIn()) {
      const allMoves = await firestoreService.getStudyMoves(studyId);
      return allMoves
        .filter(move => move.parentFen === parentFen)
        .sort((a, b) => (a.moveNumber || 0) - (b.moveNumber || 0))
        .map(doc => this.transformFromFirestore(doc));
    } else {
      return await this.localModel.getChildren(studyId, parentFen);
    }
  }

  async delete(id) {
    if (isGoogleSignedIn()) {
      return await firestoreService.deleteStudyMove(id);
    } else {
      return await this.localModel.delete(id);
    }
  }
}

// StudyFolder hybrid model
export class StudyFolder extends HybridModel {
  constructor() {
    super(localStudyFolder, 'StudyFolder');
  }

  async create(data) {
    if (isGoogleSignedIn()) {
      const result = await firestoreService.createStudyFolder(data);
      return this.transformFromFirestore(result);
    } else {
      return await this.localModel.create(data);
    }
  }

  async getByUsername(username) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudyFolders();
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await this.localModel.getByUsername(username);
    }
  }

  async update(id, data) {
    if (isGoogleSignedIn()) {
      const result = await firestoreService.updateStudyFolder(id, data);
      return this.transformFromFirestore(result);
    } else {
      return await this.localModel.update(id, data);
    }
  }

  async delete(id) {
    if (isGoogleSignedIn()) {
      return await firestoreService.deleteStudyFolder(id);
    } else {
      return await this.localModel.delete(id);
    }
  }

  async updatePositions(folderPositions) {
    if (isGoogleSignedIn()) {
      for (const { id, position } of folderPositions) {
        try {
          await firestoreService.updateStudyFolder(id, { position });
        } catch (error) {
          console.error('Error updating folder position:', error);
        }
      }
    } else {
      await this.localModel.updatePositions(folderPositions);
    }
  }
}

// StudyTag hybrid model
export class StudyTag extends HybridModel {
  constructor() {
    super(localStudyTag, 'StudyTag');
  }

  async create(data) {
    if (isGoogleSignedIn()) {
      const result = await firestoreService.createStudyTag(data);
      return this.transformFromFirestore(result);
    } else {
      return await this.localModel.create(data);
    }
  }

  async getAll() {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getStudyTags();
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await this.localModel.getAll();
    }
  }

  async list(orderField = 'name') {
    return await this.getAll();
  }

  async delete(id) {
    if (isGoogleSignedIn()) {
      return await firestoreService.deleteStudyTag(id);
    } else {
      return await this.localModel.delete(id);
    }
  }

  async createDefault() {
    if (isGoogleSignedIn()) {
      return await firestoreService.initializeDefaultTags();
    } else {
      return await this.localModel.createDefault();
    }
  }
}

// StudyTagsMapping hybrid model
export class StudyTagsMapping extends HybridModel {
  constructor() {
    super(localStudyTagsMapping, 'StudyTagsMapping');
  }

  async getTagsByStudyId(studyId) {
    if (isGoogleSignedIn()) {
      const mappings = await firestoreService.getStudyTagsMappings(studyId);
      const allTags = await firestoreService.getStudyTags();
      const tagIds = mappings.map(mapping => mapping.tagId);
      return allTags.filter(tag => tagIds.includes(tag.id));
    } else {
      return await this.localModel.getTagsByStudyId(studyId);
    }
  }

  async addTagToStudy(studyId, tagId) {
    if (isGoogleSignedIn()) {
      return await firestoreService.addTagToStudy(studyId, tagId);
    } else {
      return await this.localModel.addTagToStudy(studyId, tagId);
    }
  }

  async removeTagFromStudy(studyId, tagId) {
    if (isGoogleSignedIn()) {
      return await firestoreService.removeTagFromStudy(studyId, tagId);
    } else {
      return await this.localModel.removeTagFromStudy(studyId, tagId);
    }
  }

  async create(data) {
    if (isGoogleSignedIn()) {
      return await firestoreService.addTagToStudy(data.study_id, data.tag_id);
    } else {
      return await this.localModel.create(data);
    }
  }

  async filter(conditions) {
    if (isGoogleSignedIn()) {
      if (conditions.study_id) {
        return await firestoreService.getStudyTagsMappings(conditions.study_id);
      }
      return [];
    } else {
      return await this.localModel.filter(conditions);
    }
  }
}

// MoveAnnotation hybrid model
export class MoveAnnotation extends HybridModel {
  constructor() {
    super(localMoveAnnotation, 'MoveAnnotation');
  }

  async create(data) {
    if (isGoogleSignedIn()) {
      const result = await firestoreService.createMoveAnnotation(this.transformToFirestore(data));
      return this.transformFromFirestore(result);
    } else {
      return await this.localModel.create(data);
    }
  }

  async getByMoveId(moveId) {
    if (isGoogleSignedIn()) {
      const results = await firestoreService.getMoveAnnotations(moveId);
      return results.map(doc => this.transformFromFirestore(doc));
    } else {
      return await this.localModel.getByMoveId(moveId);
    }
  }

  async getByType(moveId, type) {
    if (isGoogleSignedIn()) {
      const annotations = await firestoreService.getMoveAnnotations(moveId);
      return annotations.filter(annotation => annotation.type === type);
    } else {
      return await this.localModel.getByType(moveId, type);
    }
  }

  async deleteByMoveId(moveId) {
    if (isGoogleSignedIn()) {
      const annotations = await firestoreService.getMoveAnnotations(moveId);
      for (const annotation of annotations) {
        await firestoreService.deleteMoveAnnotation(annotation.id);
      }
      return { success: true };
    } else {
      return await this.localModel.deleteByMoveId(moveId);
    }
  }
}

// Export singleton instances
export const userStudy = new UserStudy();
export const userStudyMove = new UserStudyMove();
export const moveAnnotation = new MoveAnnotation();
export const studyTag = new StudyTag();
export const studyTagsMapping = new StudyTagsMapping();
export const studyFolder = new StudyFolder();

// Legacy exports for backward compatibility
export const UserOpening = UserStudy;
export const UserOpeningMove = UserStudyMove;
export const userOpening = userStudy;
export const userOpeningMove = userStudyMove;

// Database readiness functions (always ready)
export const isDatabaseReady = () => true;
export const waitForDatabase = async () => true;

// Helper functions
export const checkPositionInStudies = async (fen, username) => {
  if (isGoogleSignedIn()) {
    // Use Firestore version (would need to implement)
    return await localCheckPositionInStudies(fen, username);
  } else {
    return await localCheckPositionInStudies(fen, username);
  }
};

export const getStudyPositions = async (studyId) => {
  if (isGoogleSignedIn()) {
    // Use Firestore version
    return await localGetStudyPositions(studyId);
  } else {
    return await localGetStudyPositions(studyId);
  }
};

export const getAllStudyPositionsMap = async (username) => {
  if (isGoogleSignedIn()) {
    // Use Firestore version
    return await localGetAllStudyPositionsMap(username);
  } else {
    return await localGetAllStudyPositionsMap(username);
  }
};

// Legacy functions for backward compatibility
export const checkPositionInOpenings = checkPositionInStudies;
export const getOpeningPositions = getStudyPositions;
export const getAllOpeningPositionsMap = getAllStudyPositionsMap;