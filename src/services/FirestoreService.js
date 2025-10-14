import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase.js';
import { firebaseAuth } from './FirebaseAuth.js';
import { DEFAULT_STUDY_TAGS, DEFAULT_TAG_COLOR, DEFAULT_FOLDER_COLOR } from '@/constants/colors';

class FirestoreService {
  constructor() {
    this.currentUserId = null;
    this.authPromise = null;
    this.isAuthReady = false;
    
    // Listen for auth changes
    firebaseAuth.onAuthStateChange((user) => {
      this.currentUserId = user ? user.uid : null;
      this.isAuthReady = true;
      
      // Resolve any pending auth promises
      if (this.authPromise) {
        this.authPromise = null;
      }
    });
  }

  // Helper to wait for authentication to be ready
  async waitForAuth() {
    if (this.isAuthReady) {
      return this.currentUserId;
    }
    
    // Wait for auth state to be determined
    return new Promise((resolve) => {
      const unsubscribe = firebaseAuth.onAuthStateChange((user) => {
        unsubscribe();
        this.currentUserId = user ? user.uid : null;
        this.isAuthReady = true;
        resolve(this.currentUserId);
      });
    });
  }

  // Helper to ensure user is authenticated
  async requireAuth() {
    const userId = await this.waitForAuth();
    if (!userId) {
      throw new Error('User must be authenticated to perform this operation');
    }
    return userId;
  }

  // Helper to get user-scoped collection reference
  async getUserCollection(collectionName) {
    const userId = await this.requireAuth();
    return collection(db, 'users', userId, collectionName);
  }

  // Helper to get user-scoped document reference
  async getUserDoc(collectionName, docId) {
    const userId = await this.requireAuth();
    return doc(db, 'users', userId, collectionName, docId);
  }

  // CHESS GAMES OPERATIONS
  async saveChessGame(gameData) {
    try {
      const gamesRef = await this.getUserCollection('chess_games');
      
      const gameDoc = {
        ...gameData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(gamesRef, gameDoc);
      return { id: docRef.id, ...gameDoc };
    } catch (error) {
      console.error('Error saving chess game:', error);
      throw error;
    }
  }

  async getChessGames(queryOptions = {}) {
    try {
      const gamesRef = await this.getUserCollection('chess_games');
      let q = gamesRef;

      // Add query constraints
      if (queryOptions.where) {
        for (const [field, operator, value] of queryOptions.where) {
          q = query(q, where(field, operator, value));
        }
      }

      if (queryOptions.orderBy) {
        const [field, direction = 'desc'] = queryOptions.orderBy;
        q = query(q, orderBy(field, direction));
      }

      if (queryOptions.limit) {
        q = query(q, limit(queryOptions.limit));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting chess games:', error);
      throw error;
    }
  }

  // USER STUDIES OPERATIONS
  async createStudy(studyData) {
    try {
      const studiesRef = await this.getUserCollection('user_studies');
      
      const studyDoc = {
        username: studyData.username,
        name: studyData.name,
        color: studyData.color,
        initialFen: studyData.initial_fen || studyData.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        initialViewFen: studyData.initial_view_fen || studyData.initialViewFen || studyData.initial_fen || studyData.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        folderId: studyData.folder_id || studyData.folderId || null,
        position: studyData.position || 0,
        moveTree: studyData.moveTree || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(studiesRef, studyDoc);
      return { id: docRef.id, ...studyDoc };
    } catch (error) {
      console.error('Error creating study:', error);
      throw error;
    }
  }

  async updateStudy(studyId, studyData) {
    try {
      const studiesRef = await this.getUserCollection('user_studies');
      const studyDocRef = doc(studiesRef, studyId);
      
      // Build the update data object, only including fields that are provided
      const updateData = {
        updatedAt: serverTimestamp()
      };
      
      // Only update fields that are explicitly provided
      if ('username' in studyData) updateData.username = studyData.username;
      if ('name' in studyData) updateData.name = studyData.name;
      if ('color' in studyData) updateData.color = studyData.color;
      if ('initial_fen' in studyData || 'initialFen' in studyData) {
        updateData.initialFen = studyData.initial_fen || studyData.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      if ('initial_view_fen' in studyData || 'initialViewFen' in studyData) {
        updateData.initialViewFen = studyData.initial_view_fen || studyData.initialViewFen || studyData.initial_fen || studyData.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      if ('folder_id' in studyData || 'folderId' in studyData) {
        updateData.folderId = studyData.folder_id !== undefined ? studyData.folder_id : studyData.folderId;
      }
      if ('position' in studyData) updateData.position = studyData.position;
      if ('moveTree' in studyData) updateData.moveTree = studyData.moveTree || null;

      await updateDoc(studyDocRef, updateData);
      
      // Return the updated document
      const updatedDoc = await getDoc(studyDocRef);
      return { id: updatedDoc.id, ...updatedDoc.data() };
    } catch (error) {
      console.error('Error updating study:', error);
      throw error;
    }
  }

  async getStudies(queryOptions = {}) {
    try {
      const studiesRef = await this.getUserCollection('user_studies');
      let q = studiesRef;

      // Add query constraints
      if (queryOptions.where) {
        for (const [field, operator, value] of queryOptions.where) {
          q = query(q, where(field, operator, value));
        }
      }

      if (queryOptions.orderBy) {
        const [field, direction = 'desc'] = queryOptions.orderBy;
        q = query(q, orderBy(field, direction));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting studies:', error);
      throw error;
    }
  }

  async getStudyById(studyId) {
    try {
      const studyIdString = String(studyId);

      const studyRef = await this.getUserDoc('user_studies', studyIdString);

      const snapshot = await getDoc(studyRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        const result = { id: snapshot.id, ...data };
        return result;
      }
      return null;
    } catch (error) {
      console.error('[FirestoreService.getStudyById] Error getting study by ID:', error);
      console.error('[FirestoreService.getStudyById] Error stack:', error.stack);
      throw error;
    }
  }


  async deleteStudy(studyId) {
    try {
      // Delete all moves for this study first
      await this.deleteStudyMoves(studyId);
      
      // Delete study tags mappings
      await this.deleteStudyTagsMappings(studyId);
      
      // Delete the study
      const studyRef = await this.getUserDoc('user_studies', String(studyId));
      await deleteDoc(studyRef);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting study:', error);
      throw error;
    }
  }

  // STUDY MOVES OPERATIONS
  async createStudyMove(moveData) {
    try {
      const movesRef = await this.getUserCollection('user_study_moves');
      
      const moveDoc = {
        ...moveData,
        arrows: moveData.arrows || [],
        highlights: moveData.highlights || [],
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(movesRef, moveDoc);
      return { id: docRef.id, ...moveDoc };
    } catch (error) {
      console.error('Error creating study move:', error);
      throw error;
    }
  }

  async getStudyMoves(studyId) {
    try {
      const movesRef = await this.getUserCollection('user_study_moves');
      const q = query(
        movesRef,
        where('studyId', '==', studyId),
        orderBy('moveNumber', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting study moves:', error);
      
      // If it's an index error, try without ordering as a fallback
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.warn('Index not available, fetching moves without ordering. Please create the index using the link in the console.');
        try {
          const movesRef = await this.getUserCollection('user_study_moves');
          const q = query(movesRef, where('studyId', '==', studyId));
          const snapshot = await getDocs(q);
          const moves = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          // Sort client-side as a workaround
          return moves.sort((a, b) => (a.moveNumber || 0) - (b.moveNumber || 0));
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return []; // Return empty array to allow study to load without moves
        }
      }
      
      throw error;
    }
  }

  async deleteStudyMoves(studyId) {
    try {
      const movesRef = await this.getUserCollection('user_study_moves');
      const q = query(movesRef, where('studyId', '==', studyId));
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error deleting study moves:', error);
      throw error;
    }
  }

  async deleteStudyMove(moveId) {
    try {
      const movesRef = await this.getUserCollection('user_study_moves');
      const moveDoc = doc(movesRef, moveId);
      await deleteDoc(moveDoc);
      return { success: true };
    } catch (error) {
      console.error('Error deleting study move:', error);
      throw error;
    }
  }

  // STUDY FOLDERS OPERATIONS
  async createStudyFolder(folderData) {
    try {
      const foldersRef = await this.getUserCollection('study_folders');
      
      const folderDoc = {
        ...folderData,
        icon: folderData.icon || 'folder',
        color: folderData.color || DEFAULT_FOLDER_COLOR.value,
        position: folderData.position || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(foldersRef, folderDoc);
      return { id: docRef.id, ...folderDoc };
    } catch (error) {
      console.error('Error creating study folder:', error);
      throw error;
    }
  }

  async getStudyFolders() {
    try {
      const foldersRef = await this.getUserCollection('study_folders');
      const q = query(foldersRef, orderBy('position', 'asc'));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting study folders:', error);
      throw error;
    }
  }

  async deleteStudyFolder(folderId) {
    try {
      // Update all studies in this folder to have no folder
      const studiesRef = await this.getUserCollection('user_studies');
      const q = query(studiesRef, where('folderId', '==', folderId));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { folderId: null });
      });
      
      // Delete the folder
      const folderRef = await this.getUserDoc('study_folders', String(folderId));
      batch.delete(folderRef);
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error deleting study folder:', error);
      throw error;
    }
  }

  async updateStudyFolder(folderId, updateData) {
    try {
      const folderRef = await this.getUserDoc('study_folders', String(folderId));
      const updateDocData = {
        ...updateData,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(folderRef, updateDocData);
      return { id: folderId, ...updateDocData };
    } catch (error) {
      console.error('Error updating study folder:', error);
      throw error;
    }
  }

  // STUDY TAGS OPERATIONS
  async createStudyTag(tagData) {
    try {
      const tagsRef = await this.getUserCollection('study_tags');
      
      const tagDoc = {
        ...tagData,
        color: tagData.color || DEFAULT_TAG_COLOR.value,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(tagsRef, tagDoc);
      return { id: docRef.id, ...tagDoc };
    } catch (error) {
      console.error('Error creating study tag:', error);
      throw error;
    }
  }

  async getStudyTags() {
    try {
      const tagsRef = await this.getUserCollection('study_tags');
      const q = query(tagsRef, orderBy('name', 'asc'));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting study tags:', error);
      throw error;
    }
  }

  async deleteStudyTag(tagId) {
    try {
      // Delete all tag mappings for this tag
      await this.deleteTagMappings(tagId);
      
      // Delete the tag
      const tagRef = await this.getUserDoc('study_tags', String(tagId));
      await deleteDoc(tagRef);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting study tag:', error);
      throw error;
    }
  }

  // STUDY TAGS MAPPING OPERATIONS
  async addTagToStudy(studyId, tagId) {
    try {
      const mappingsRef = await this.getUserCollection('study_tags_mapping');
      
      // Check if mapping already exists
      const q = query(
        mappingsRef,
        where('studyId', '==', studyId),
        where('tagId', '==', tagId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return { success: true, message: 'Tag already assigned to study' };
      }

      const mappingDoc = {
        studyId,
        tagId,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(mappingsRef, mappingDoc);
      return { id: docRef.id, ...mappingDoc };
    } catch (error) {
      console.error('Error adding tag to study:', error);
      throw error;
    }
  }

  async removeTagFromStudy(studyId, tagId) {
    try {
      const mappingsRef = await this.getUserCollection('study_tags_mapping');
      const q = query(
        mappingsRef,
        where('studyId', '==', studyId),
        where('tagId', '==', tagId)
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error removing tag from study:', error);
      throw error;
    }
  }

  async getStudyTagsMappings(studyId) {
    try {
      const mappingsRef = await this.getUserCollection('study_tags_mapping');
      const q = query(mappingsRef, where('studyId', '==', studyId));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting study tags mappings:', error);
      throw error;
    }
  }

  async deleteStudyTagsMappings(studyId) {
    try {
      const mappingsRef = await this.getUserCollection('study_tags_mapping');
      const q = query(mappingsRef, where('studyId', '==', studyId));
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error deleting study tags mappings:', error);
      throw error;
    }
  }

  async deleteTagMappings(tagId) {
    try {
      const mappingsRef = await this.getUserCollection('study_tags_mapping');
      const q = query(mappingsRef, where('tagId', '==', tagId));
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error deleting tag mappings:', error);
      throw error;
    }
  }

  // MOVE ANNOTATIONS OPERATIONS
  async createMoveAnnotation(annotationData) {
    try {
      const annotationsRef = await this.getUserCollection('move_annotations');
      
      const annotationDoc = {
        ...annotationData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(annotationsRef, annotationDoc);
      return { id: docRef.id, ...annotationDoc };
    } catch (error) {
      console.error('Error creating move annotation:', error);
      throw error;
    }
  }

  async getMoveAnnotations(moveId) {
    try {
      const annotationsRef = await this.getUserCollection('move_annotations');
      const q = query(
        annotationsRef,
        where('moveId', '==', moveId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting move annotations:', error);
      throw error;
    }
  }

  // USER PROFILE OPERATIONS
  async saveUserProfile(profileData) {
    try {
      const userId = await this.requireAuth();
      const userRef = doc(db, 'users', userId);
      
      const profileDoc = {
        ...profileData,
        updatedAt: serverTimestamp()
      };

      // Check if document exists
      const docSnapshot = await getDoc(userRef);
      
      if (docSnapshot.exists()) {
        // Document exists, update it
        await updateDoc(userRef, profileDoc);
      } else {
        // Document doesn't exist, create it
        const newProfileDoc = {
          ...profileDoc,
          createdAt: serverTimestamp()
        };
        await setDoc(userRef, newProfileDoc);
      }
      
      return { id: userId, ...profileDoc };
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }
  }

  async getUserProfile() {
    try {
      const userId = await this.requireAuth();
      const userRef = doc(db, 'users', userId);
      const snapshot = await getDoc(userRef);
      
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  async createUserProfile(userData) {
    try {
      const userId = await this.requireAuth();
      const userRef = doc(db, 'users', userId);
      
      const profileDoc = {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(userRef, profileDoc);
      return { id: userId, ...profileDoc };
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  // REAL-TIME SUBSCRIPTIONS
  async subscribeToStudies(callback) {
    try {
      const studiesRef = await this.getUserCollection('user_studies');
      const q = query(studiesRef, orderBy('updatedAt', 'desc'));
      
      return onSnapshot(q, (snapshot) => {
        const studies = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(studies);
      });
    } catch (error) {
      console.error('Error subscribing to studies:', error);
      throw error;
    }
  }

  async subscribeToStudyFolders(callback) {
    try {
      const foldersRef = await this.getUserCollection('study_folders');
      const q = query(foldersRef, orderBy('position', 'asc'));
      
      return onSnapshot(q, (snapshot) => {
        const folders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(folders);
      });
    } catch (error) {
      console.error('Error subscribing to study folders:', error);
      throw error;
    }
  }

  // BULK OPERATIONS
  async bulkCreateStudies(studiesData) {
    try {
      const batch = writeBatch(db);
      const studiesRef = await this.getUserCollection('user_studies');
      const results = [];

      studiesData.forEach(studyData => {
        const docRef = doc(studiesRef);
        const studyDoc = {
          ...studyData,
          initialMoves: studyData.initial_moves || [],
          initialFen: studyData.initial_fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        batch.set(docRef, studyDoc);
        results.push({ id: docRef.id, ...studyDoc });
      });

      await batch.commit();
      return results;
    } catch (error) {
      console.error('Error bulk creating studies:', error);
      throw error;
    }
  }

  async bulkCreateStudyMoves(movesData) {
    try {
      const batch = writeBatch(db);
      const movesRef = await this.getUserCollection('user_study_moves');
      const results = [];

      movesData.forEach(moveData => {
        const docRef = doc(movesRef);
        const moveDoc = {
          ...moveData,
          arrows: moveData.arrows || [],
          highlights: moveData.highlights || [],
          createdAt: serverTimestamp()
        };
        
        batch.set(docRef, moveDoc);
        results.push({ id: docRef.id, ...moveDoc });
      });

      await batch.commit();
      return results;
    } catch (error) {
      console.error('Error bulk creating study moves:', error);
      throw error;
    }
  }

  // INITIALIZE DEFAULT TAGS (idempotent - safe to call multiple times)
  async initializeDefaultTags() {
    try {
      const defaultTags = DEFAULT_STUDY_TAGS.map(tag => ({
        name: tag.name,
        color: tag.color
      }));

      // Check if tags already exist
      const existingTags = await this.getStudyTags();
      const existingTagNames = new Set(existingTags.map(tag => tag.name));

      // Only create tags that don't exist
      const tagsToCreate = defaultTags.filter(tag => !existingTagNames.has(tag.name));
      
      if (tagsToCreate.length > 0) {
        const batch = writeBatch(db);
        const tagsRef = await this.getUserCollection('study_tags');

        tagsToCreate.forEach(tagData => {
          const docRef = doc(tagsRef);
          batch.set(docRef, {
            ...tagData,
            createdAt: serverTimestamp()
          });
        });

        await batch.commit();
      }

      return { success: true, created: tagsToCreate.length };
    } catch (error) {
      console.error('Error initializing default tags:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
export const firestoreService = new FirestoreService();
export default firestoreService;