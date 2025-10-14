// Local storage implementation for when user is not signed in with Google
// This provides the same API as firestoreEntities but stores data locally

import { normalizeFen } from '../utils/chessUtils.js';
import { TAG_COLORS } from '../constants/colors.js';

// Helper to generate unique IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Base class for local storage entities
class BaseLocalModel {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.storageKey = `chesscope_local_${collectionName}`;
  }

  // Get all items from local storage
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error reading ${this.collectionName} from localStorage:`, error);
      return [];
    }
  }

  // Save all items to local storage
  saveAll(items) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (error) {
      console.error(`Error saving ${this.collectionName} to localStorage:`, error);
      // Handle quota exceeded error
      if (error.name === 'QuotaExceededError') {
        throw new Error('Local storage is full. Please sign in with Google to save to cloud.');
      }
      throw error;
    }
  }

  // Create a new item
  async create(data) {
    const items = this.getAll();
    const newItem = {
      ...data,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.push(newItem);
    this.saveAll(items);
    return newItem;
  }

  // Get item by ID
  async getById(id) {
    const items = this.getAll();
    return items.find(item => item.id === id) || null;
  }

  // Update an item
  async update(id, data) {
    const items = this.getAll();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }
    items[index] = {
      ...items[index],
      ...data,
      updated_at: new Date().toISOString()
    };
    this.saveAll(items);
    return items[index];
  }

  // Delete an item
  async delete(id) {
    const items = this.getAll();
    const filtered = items.filter(item => item.id !== id);
    this.saveAll(filtered);
    return { success: true };
  }

  // Filter items
  async filter(conditions = {}, orderField = 'created_at', limitCount = null) {
    let items = this.getAll();
    
    // Apply filters
    Object.entries(conditions).forEach(([key, value]) => {
      items = items.filter(item => item[key] === value);
    });
    
    // Apply ordering
    if (orderField) {
      const isDescending = orderField.startsWith('-');
      const field = isDescending ? orderField.slice(1) : orderField;
      
      items.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        
        if (aVal < bVal) return isDescending ? 1 : -1;
        if (aVal > bVal) return isDescending ? -1 : 1;
        return 0;
      });
    }
    
    // Apply limit
    if (limitCount) {
      items = items.slice(0, limitCount);
    }
    
    return items;
  }

  // List all items
  async list(orderField = 'created_at', limitCount = null) {
    return this.filter({}, orderField, limitCount);
  }
}

// UserStudy model for local storage
export class LocalUserStudy extends BaseLocalModel {
  constructor() {
    super('user_studies');
  }

  async create(data) {
    // Ensure initial_moves is an array
    if (typeof data.initial_moves === 'string') {
      try {
        data.initial_moves = JSON.parse(data.initial_moves);
      } catch (e) {
        data.initial_moves = [];
      }
    }
    return super.create(data);
  }

  async getByUsername(username) {
    // In local storage, we don't need username filtering as it's all local
    return this.list('-updated_at');
  }

  async getByName(username, name) {
    const results = await this.filter({ name });
    return results.length > 0 ? results[0] : null;
  }

  async getByFolder(folderId) {
    return this.filter({ folder_id: folderId }, 'position');
  }

  async getUnfolderedByUsername(username) {
    const all = this.getAll();
    return all.filter(study => !study.folder_id || study.folder_id === 0)
              .sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  async updatePositions(studyPositions) {
    for (const { id, position, folderId } of studyPositions) {
      await this.update(id, { position, folder_id: folderId || null });
    }
  }
}

// UserStudyMove model for local storage
export class LocalUserStudyMove extends BaseLocalModel {
  constructor() {
    super('user_study_moves');
  }

  async create(data) {
    // Ensure arrays are preserved
    const processedData = {
      ...data,
      arrows: Array.isArray(data.arrows) ? data.arrows : (data.arrows ? JSON.parse(data.arrows) : []),
      highlights: Array.isArray(data.highlights) ? data.highlights : (data.highlights ? JSON.parse(data.highlights) : [])
    };
    return super.create(processedData);
  }

  async getByStudyId(studyId) {
    return this.filter({ study_id: studyId }, 'move_number');
  }

  async getByFen(fen) {
    return this.filter({ fen });
  }

  async getChildren(studyId, parentFen) {
    const all = await this.getByStudyId(studyId);
    return all.filter(move => move.parent_fen === parentFen)
              .sort((a, b) => (a.move_number || 0) - (b.move_number || 0));
  }
}

// MoveAnnotation model for local storage
export class LocalMoveAnnotation extends BaseLocalModel {
  constructor() {
    super('move_annotations');
  }

  async getByMoveId(moveId) {
    return this.filter({ move_id: moveId }, '-created_at');
  }

  async getByType(moveId, type) {
    return this.filter({ move_id: moveId, type });
  }

  async deleteByMoveId(moveId) {
    const annotations = await this.getByMoveId(moveId);
    for (const annotation of annotations) {
      await this.delete(annotation.id);
    }
    return { success: true };
  }
}

// StudyTag model for local storage
export class LocalStudyTag extends BaseLocalModel {
  constructor() {
    super('study_tags');
  }

  async getAll() {
    const items = super.getAll();
    return items.sort((a, b) => {
      const aVal = a.name || '';
      const bVal = b.name || '';
      return aVal.localeCompare(bVal);
    });
  }

  async createDefault() {
    const defaultTags = [
      { name: 'Opening', color: TAG_COLORS[2].value },      // Green
      { name: 'Middlegame', color: TAG_COLORS[1].value },   // Blue
      { name: 'Endgame', color: TAG_COLORS[3].value },      // Amber
      { name: 'Tactics', color: TAG_COLORS[1].value },      // Red
      { name: 'Strategy', color: TAG_COLORS[4].value },     // Purple
      { name: 'Defense', color: TAG_COLORS[5].value }       // Cyan
    ];

    const existingTags = await this.getAll();
    const existingNames = new Set(existingTags.map(tag => tag.name));

    for (const tag of defaultTags) {
      if (!existingNames.has(tag.name)) {
        await this.create(tag);
      }
    }
  }
}

// StudyFolder model for local storage
export class LocalStudyFolder extends BaseLocalModel {
  constructor() {
    super('study_folders');
  }

  async getByUsername(username) {
    // In local storage, all folders are for the current user
    return this.list('position');
  }

  async updatePositions(folderPositions) {
    for (const { id, position } of folderPositions) {
      await this.update(id, { position });
    }
  }
}

// StudyTagsMapping model for local storage
export class LocalStudyTagsMapping extends BaseLocalModel {
  constructor() {
    super('study_tags_mapping');
  }

  async getTagsByStudyId(studyId) {
    const mappings = await this.filter({ study_id: studyId });
    const tagIds = mappings.map(m => m.tag_id);
    
    // Get all tags and filter by IDs
    const tagsModel = new LocalStudyTag();
    const allTags = await tagsModel.getAll();
    
    return allTags.filter(tag => tagIds.includes(tag.id));
  }

  async addTagToStudy(studyId, tagId) {
    // Check if mapping already exists
    const existing = await this.filter({ study_id: studyId, tag_id: tagId });
    if (existing.length > 0) {
      return { success: true, message: 'Tag already assigned to study' };
    }
    
    return this.create({ study_id: studyId, tag_id: tagId });
  }

  async removeTagFromStudy(studyId, tagId) {
    const mappings = await this.filter({ study_id: studyId, tag_id: tagId });
    for (const mapping of mappings) {
      await this.delete(mapping.id);
    }
    return { success: true };
  }
}

// Export singleton instances
export const localUserStudy = new LocalUserStudy();
export const localUserStudyMove = new LocalUserStudyMove();
export const localMoveAnnotation = new LocalMoveAnnotation();
export const localStudyTag = new LocalStudyTag();
export const localStudyTagsMapping = new LocalStudyTagsMapping();
export const localStudyFolder = new LocalStudyFolder();

// Helper functions (same as firestoreEntities)
export const checkPositionInStudies = async (fen, username) => {
  try {
    const normalizedInputFen = normalizeFen(fen);
    const studies = await localUserStudy.getByUsername(username);
    const matchingStudies = [];
    
    for (const study of studies) {
      const moves = await localUserStudyMove.getByStudyId(study.id);
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

export const getStudyPositions = async (studyId) => {
  try {
    const moves = await localUserStudyMove.getByStudyId(studyId);
    return moves.map(move => move.fen);
  } catch (error) {
    console.error('Error getting study positions:', error);
    return [];
  }
};

export const getAllStudyPositionsMap = async (username) => {
  try {
    const studies = await localUserStudy.getByUsername(username);
    if (studies.length === 0) return new Map();
    
    const fenToStudiesMap = new Map();
    
    for (const study of studies) {
      const moves = await localUserStudyMove.getByStudyId(study.id);
      
      for (const move of moves) {
        const normalizedFen = normalizeFen(move.fen);
        
        if (!fenToStudiesMap.has(normalizedFen)) {
          fenToStudiesMap.set(normalizedFen, []);
        }
        
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