import { googleAuth } from './GoogleAuth.js';
import initSqlJs from 'sql.js';

class GoogleDriveSyncService {
  constructor() {
    this.syncFileName = 'chesscope-studies-sync.db';
    this.syncFolderId = null;
    this.isSyncEnabled = false;
  }

  async enableSync() {
    if (!googleAuth.isSignedIn) {
      throw new Error('User must be signed in to Google');
    }

    if (this.isSyncEnabled) {
      return true;
    }

    try {
      // Create or find sync folder
      await this.ensureSyncFolder();
      this.isSyncEnabled = true;
      return true;
    } catch (error) {
      console.error('Failed to enable sync:', error);
      this.isSyncEnabled = false;
      throw error;
    }
  }

  async ensureSyncFolder() {
    try {
      const accessToken = googleAuth.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available. Please sign in again.');
      }

      // Search for existing ChessScope folder
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='ChessScope' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&spaces=drive`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for folder: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        this.syncFolderId = searchData.files[0].id;
      } else {
        // Create new folder
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'ChessScope',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        
        if (!createResponse.ok) {
          throw new Error(`Failed to create folder: ${createResponse.statusText}`);
        }
        
        const createData = await createResponse.json();
        this.syncFolderId = createData.id;
      }
    } catch (error) {
      console.error('Error ensuring sync folder:', error);
      throw error;
    }
  }

  // Get local studies data
  async getLocalStudies() {
    try {
      const localDbString = localStorage.getItem('chesscope_db');
      if (!localDbString) {
        return { studies: [], folders: [], tags: [] };
      }

      const SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });
      
      const uint8Array = new Uint8Array(JSON.parse(localDbString));
      const db = new SQL.Database(uint8Array);
      
      // Get studies
      const studiesResult = db.exec("SELECT * FROM user_studies");
      const studies = studiesResult.length > 0 ? studiesResult[0].values.map(row => {
        const obj = {};
        studiesResult[0].columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      }) : [];

      // Get folders
      const foldersResult = db.exec("SELECT * FROM study_folders");
      const folders = foldersResult.length > 0 ? foldersResult[0].values.map(row => {
        const obj = {};
        foldersResult[0].columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      }) : [];

      // Get tags
      const tagsResult = db.exec("SELECT * FROM study_tags");
      const tags = tagsResult.length > 0 ? tagsResult[0].values.map(row => {
        const obj = {};
        tagsResult[0].columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      }) : [];
      
      // Get moves (with error handling for backwards compatibility)
      let moves = [];
      try {
        const movesResult = db.exec("SELECT * FROM user_study_moves");
        moves = movesResult.length > 0 ? movesResult[0].values.map(row => {
          const obj = {};
          movesResult[0].columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        }) : [];
      } catch (error) {
        console.log('user_study_moves table not found in local database (probably old database)');
      }

      // Get move annotations (with error handling for backwards compatibility)
      let annotations = [];
      try {
        const annotationsResult = db.exec("SELECT * FROM move_annotations");
        annotations = annotationsResult.length > 0 ? annotationsResult[0].values.map(row => {
          const obj = {};
          annotationsResult[0].columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        }) : [];
      } catch (error) {
        console.log('move_annotations table not found in local database (probably old database)');
      }

      // Get study tags mapping (with error handling for backwards compatibility)
      let tagsMapping = [];
      try {
        const tagsMapResult = db.exec("SELECT * FROM study_tags_mapping");
        tagsMapping = tagsMapResult.length > 0 ? tagsMapResult[0].values.map(row => {
          const obj = {};
          tagsMapResult[0].columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        }) : [];
      } catch (error) {
        console.log('study_tags_mapping table not found in local database (probably old database)');
      }

      db.close();
      
      return { studies, folders, tags, moves, annotations, tagsMapping };
    } catch (error) {
      console.error('Error getting local studies:', error);
      return { studies: [], folders: [], tags: [], moves: [], annotations: [], tagsMapping: [] };
    }
  }

  // Get remote studies data from Google Drive
  async getRemoteStudies() {
    try {
      if (!this.isSyncEnabled || !googleAuth.isSignedIn || !this.syncFolderId) {
        return { studies: [], folders: [], tags: [] };
      }

      // Search for sync file
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${this.syncFileName}' and parents in '${this.syncFolderId}' and trashed=false`)}&spaces=drive&orderBy=modifiedTime%20desc`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for sync file: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.files || searchData.files.length === 0) {
        return { studies: [], folders: [], tags: [] };
      }

      const syncFile = searchData.files[0];
      
      // Download sync file
      const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${syncFile.id}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!downloadResponse.ok) {
        throw new Error(`Download failed: ${downloadResponse.statusText}`);
      }

      const dbData = await downloadResponse.arrayBuffer();
      
      const SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });
      
      const uint8Array = new Uint8Array(dbData);
      const db = new SQL.Database(uint8Array);
      
      // Get studies
      const studiesResult = db.exec("SELECT * FROM user_studies");
      const studies = studiesResult.length > 0 ? studiesResult[0].values.map(row => {
        const obj = {};
        studiesResult[0].columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      }) : [];

      // Get folders
      const foldersResult = db.exec("SELECT * FROM study_folders");
      const folders = foldersResult.length > 0 ? foldersResult[0].values.map(row => {
        const obj = {};
        foldersResult[0].columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      }) : [];

      // Get tags
      const tagsResult = db.exec("SELECT * FROM study_tags");
      const tags = tagsResult.length > 0 ? tagsResult[0].values.map(row => {
        const obj = {};
        tagsResult[0].columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      }) : [];

      // Get moves (with error handling for backwards compatibility)
      let moves = [];
      try {
        const movesResult = db.exec("SELECT * FROM user_study_moves");
        moves = movesResult.length > 0 ? movesResult[0].values.map(row => {
          const obj = {};
          movesResult[0].columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        }) : [];
      } catch (error) {
        console.log('user_study_moves table not found in remote database (probably old database)');
      }

      // Get move annotations (with error handling for backwards compatibility)
      let annotations = [];
      try {
        const annotationsResult = db.exec("SELECT * FROM move_annotations");
        annotations = annotationsResult.length > 0 ? annotationsResult[0].values.map(row => {
          const obj = {};
          annotationsResult[0].columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        }) : [];
      } catch (error) {
        console.log('move_annotations table not found in remote database (probably old database)');
      }

      // Get study tags mapping (with error handling for backwards compatibility)
      let tagsMapping = [];
      try {
        const tagsMapResult = db.exec("SELECT * FROM study_tags_mapping");
        tagsMapping = tagsMapResult.length > 0 ? tagsMapResult[0].values.map(row => {
          const obj = {};
          tagsMapResult[0].columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        }) : [];
      } catch (error) {
        console.log('study_tags_mapping table not found in remote database (probably old database)');
      }

      db.close();
      
      return { 
        studies, 
        folders, 
        tags,
        moves,
        annotations,
        tagsMapping,
        lastModified: new Date(syncFile.modifiedTime),
        fileId: syncFile.id
      };
    } catch (error) {
      console.error('Error getting remote studies:', error);
      return { studies: [], folders: [], tags: [], moves: [], annotations: [], tagsMapping: [] };
    }
  }

  // Compare local and remote data to detect conflicts
  async compareData() {
    const local = await this.getLocalStudies();
    const remote = await this.getRemoteStudies();
    
    const conflicts = {
      localOnly: [],
      remoteOnly: [],
      modified: [],
      toDelete: []
    };

    // Create maps for easy lookup
    const localStudiesMap = new Map(local.studies.map(s => [s.id, s]));
    const remoteStudiesMap = new Map(remote.studies.map(s => [s.id, s]));

    // Find studies only in local
    for (const study of local.studies) {
      if (!remoteStudiesMap.has(study.id)) {
        conflicts.localOnly.push(study);
      } else {
        // Check if modified
        const remoteStudy = remoteStudiesMap.get(study.id);
        if (new Date(study.updated_at) > new Date(remoteStudy.updated_at)) {
          conflicts.modified.push({ local: study, remote: remoteStudy, source: 'local' });
        } else if (new Date(study.updated_at) < new Date(remoteStudy.updated_at)) {
          conflicts.modified.push({ local: study, remote: remoteStudy, source: 'remote' });
        }
      }
    }

    // Find studies only in remote
    for (const study of remote.studies) {
      if (!localStudiesMap.has(study.id)) {
        conflicts.remoteOnly.push(study);
      }
    }

    // Check if we would be deleting studies from remote (local has fewer)
    if (local.studies.length < remote.studies.length) {
      for (const remoteStudy of remote.studies) {
        if (!localStudiesMap.has(remoteStudy.id)) {
          conflicts.toDelete.push(remoteStudy);
        }
      }
    }

    return {
      local,
      remote,
      conflicts,
      hasConflicts: conflicts.localOnly.length > 0 || 
                   conflicts.remoteOnly.length > 0 || 
                   conflicts.modified.length > 0 ||
                   conflicts.toDelete.length > 0
    };
  }

  // Sync studies to Google Drive (additive only, never removes without permission)
  async syncToRemote(mergeStrategy = 'merge') {
    try {
      const comparison = await this.compareData();
      
      // Only throw deletion warning for strategies that would actually delete data
      if (comparison.conflicts.toDelete.length > 0 && mergeStrategy !== 'force_overwrite' && mergeStrategy !== 'merge') {
        throw new Error(`DELETION_WARNING: The following studies exist in cloud only: ${comparison.conflicts.toDelete.map(s => s.name).join(', ')}. Use force_overwrite if you're sure.`);
      }

      // Create merged data based on strategy
      let mergedStudies = [];
      let mergedFolders = comparison.local.folders;
      let mergedTags = comparison.local.tags;
      let mergedMoves = [];
      let mergedAnnotations = [];
      let mergedTagsMapping = [];

      switch (mergeStrategy) {
        case 'merge':
          // Keep all studies from both local and remote
          mergedStudies = [...comparison.local.studies];
          for (const remoteStudy of comparison.remote.studies) {
            const localExists = comparison.local.studies.find(s => s.id === remoteStudy.id);
            if (!localExists) {
              mergedStudies.push(remoteStudy);
            }
          }
          
          // Merge moves - keep all local moves and add remote moves for studies that exist
          mergedMoves = [...comparison.local.moves || []];
          for (const remoteMove of comparison.remote.moves || []) {
            const localMoveExists = mergedMoves.find(m => m.id === remoteMove.id);
            const studyExists = mergedStudies.find(s => s.id === remoteMove.study_id);
            if (!localMoveExists && studyExists) {
              mergedMoves.push(remoteMove);
            }
          }
          
          // Merge annotations
          mergedAnnotations = [...comparison.local.annotations || []];
          for (const remoteAnnotation of comparison.remote.annotations || []) {
            const localAnnotationExists = mergedAnnotations.find(a => a.id === remoteAnnotation.id);
            const moveExists = mergedMoves.find(m => m.id === remoteAnnotation.move_id);
            if (!localAnnotationExists && moveExists) {
              mergedAnnotations.push(remoteAnnotation);
            }
          }
          
          // Merge tags mapping
          mergedTagsMapping = [...comparison.local.tagsMapping || []];
          for (const remoteMapping of comparison.remote.tagsMapping || []) {
            const localMappingExists = mergedTagsMapping.find(tm => tm.id === remoteMapping.id);
            const studyExists = mergedStudies.find(s => s.id === remoteMapping.study_id);
            if (!localMappingExists && studyExists) {
              mergedTagsMapping.push(remoteMapping);
            }
          }
          break;
        
        case 'local_only':
          mergedStudies = comparison.local.studies;
          mergedMoves = comparison.local.moves || [];
          mergedAnnotations = comparison.local.annotations || [];
          mergedTagsMapping = comparison.local.tagsMapping || [];
          break;
        
        case 'remote_only':
          mergedStudies = comparison.remote.studies;
          mergedMoves = comparison.remote.moves || [];
          mergedAnnotations = comparison.remote.annotations || [];
          mergedTagsMapping = comparison.remote.tagsMapping || [];
          break;
        
        case 'force_overwrite':
          mergedStudies = comparison.local.studies;
          mergedMoves = comparison.local.moves || [];
          mergedAnnotations = comparison.local.annotations || [];
          mergedTagsMapping = comparison.local.tagsMapping || [];
          break;
        
        default:
          throw new Error('Invalid merge strategy');
      }

      // Create database with merged data and upload to remote
      await this.uploadMergedData({ 
        studies: mergedStudies, 
        folders: mergedFolders, 
        tags: mergedTags,
        moves: mergedMoves,
        annotations: mergedAnnotations,
        tagsMapping: mergedTagsMapping
      });
      
      // Update local database with merged data to prevent conflicts
      await this.updateLocalWithMergedData({ 
        studies: mergedStudies, 
        folders: mergedFolders, 
        tags: mergedTags,
        moves: mergedMoves,
        annotations: mergedAnnotations,
        tagsMapping: mergedTagsMapping
      });
      
      return { success: true, studyCount: mergedStudies.length };
    } catch (error) {
      console.error('Sync to remote failed:', error);
      throw error;
    }
  }

  // Upload merged data to Google Drive
  async uploadMergedData(data) {
    try {
      const SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });
      
      const db = new SQL.Database();
      
      // Create tables
      db.run(`CREATE TABLE user_studies (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        initial_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        initial_moves TEXT DEFAULT '[]',
        initial_view_fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        starting_pgn TEXT DEFAULT '',
        folder_id INTEGER,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE study_folders (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'folder',
        color TEXT DEFAULT '#6366f1',
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE study_tags (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6366f1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE user_study_moves (
        id INTEGER PRIMARY KEY,
        study_id INTEGER NOT NULL,
        fen TEXT NOT NULL,
        san TEXT NOT NULL,
        uci TEXT,
        move_number INTEGER NOT NULL,
        parent_fen TEXT,
        is_main_line BOOLEAN DEFAULT 1,
        is_initial_move BOOLEAN DEFAULT 0,
        evaluation TEXT,
        comment TEXT,
        arrows TEXT,
        highlights TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (study_id) REFERENCES user_studies(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE move_annotations (
        id INTEGER PRIMARY KEY,
        move_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (move_id) REFERENCES user_study_moves(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE study_tags_mapping (
        id INTEGER PRIMARY KEY,
        study_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (study_id) REFERENCES user_studies(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES study_tags(id) ON DELETE CASCADE
      )`);

      // Insert data
      for (const study of data.studies) {
        const stmt = db.prepare(`INSERT INTO user_studies (id, username, name, color, initial_fen, initial_moves, initial_view_fen, starting_pgn, folder_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run([
          study.id, study.username, study.name, study.color,
          study.initial_fen, study.initial_moves, study.initial_view_fen,
          study.starting_pgn, study.folder_id, study.position,
          study.created_at, study.updated_at
        ]);
        stmt.free();
      }

      for (const folder of data.folders) {
        const stmt = db.prepare(`INSERT INTO study_folders (id, username, name, icon, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run([
          folder.id, folder.username, folder.name, folder.icon,
          folder.color, folder.position, folder.created_at, folder.updated_at
        ]);
        stmt.free();
      }

      for (const tag of data.tags) {
        const stmt = db.prepare(`INSERT INTO study_tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`);
        stmt.run([tag.id, tag.name, tag.color, tag.created_at]);
        stmt.free();
      }

      // Insert moves
      for (const move of data.moves || []) {
        const stmt = db.prepare(`INSERT INTO user_study_moves (id, study_id, fen, san, uci, move_number, parent_fen, is_main_line, is_initial_move, evaluation, comment, arrows, highlights, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run([
          move.id, move.study_id, move.fen, move.san, move.uci, move.move_number,
          move.parent_fen, move.is_main_line, move.is_initial_move, move.evaluation,
          move.comment, move.arrows, move.highlights, move.created_at
        ]);
        stmt.free();
      }

      // Insert annotations
      for (const annotation of data.annotations || []) {
        const stmt = db.prepare(`INSERT INTO move_annotations (id, move_id, type, content, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        stmt.run([
          annotation.id, annotation.move_id, annotation.type, annotation.content,
          annotation.url, annotation.created_at, annotation.updated_at
        ]);
        stmt.free();
      }

      // Insert tags mapping
      for (const mapping of data.tagsMapping || []) {
        const stmt = db.prepare(`INSERT INTO study_tags_mapping (id, study_id, tag_id, created_at) VALUES (?, ?, ?, ?)`);
        stmt.run([mapping.id, mapping.study_id, mapping.tag_id, mapping.created_at]);
        stmt.free();
      }

      // Export database
      const dbData = db.export();
      const blob = new Blob([dbData], { type: 'application/x-sqlite3' });
      
      db.close();

      // Upload to Google Drive
      await this.uploadToGoogleDrive(blob);
      
    } catch (error) {
      console.error('Error uploading merged data:', error);
      throw error;
    }
  }

  // Upload database blob to Google Drive
  async uploadToGoogleDrive(blob) {
    try {
      // Check if sync file already exists
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${this.syncFileName}' and parents in '${this.syncFolderId}' and trashed=false`)}&spaces=drive`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for existing sync file: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      let fileId = null;
      if (searchData.files && searchData.files.length > 0) {
        fileId = searchData.files[0].id;
      }

      // Upload or update file
      const metadata = {
        name: this.syncFileName,
        description: `ChessScope studies sync - ${new Date().toISOString()}`
      };

      if (!fileId) {
        metadata.parents = [this.syncFolderId];
      }

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const url = fileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const method = fileId ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${googleAuth.getAccessToken()}`,
        },
        body: form
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error:', response.status, response.statusText, errorText);
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading to Google Drive:', error);
      throw error;
    }
  }

  // Update local database with merged data
  async updateLocalWithMergedData(mergedData) {
    try {
      
      // Ensure database is initialized before proceeding
      const dbModule = await import('../api/database.js');
      await dbModule.waitForDatabase();
      
      // Import necessary modules
      const { userStudy, studyFolder, studyTag, userStudyMove, moveAnnotation, studyTagsMapping } = await import('../api/studyEntities.js');
      
      // Add any new studies from remote to local database
      for (const study of mergedData.studies) {
        try {
          // Check if study already exists locally using filter
          const existingStudies = await userStudy.filter({ id: study.id });
          if (!existingStudies || existingStudies.length === 0) {
            // Study doesn't exist locally, add it
            await userStudy.create({
              id: study.id,
              username: study.username,
              name: study.name,
              color: study.color,
              initial_fen: study.initial_fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              initial_moves: study.initial_moves || '[]',
              initial_view_fen: study.initial_view_fen || study.initial_fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              starting_pgn: study.starting_pgn || '',
              folder_id: study.folder_id || null,
              position: study.position || 0,
              created_at: study.created_at,
              updated_at: study.updated_at
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not add study ${study.name} to local:`, error);
        }
      }
      
      // Add any new folders
      for (const folder of mergedData.folders || []) {
        try {
          const existingFolders = await studyFolder.filter({ id: folder.id });
          if (!existingFolders || existingFolders.length === 0) {
            await studyFolder.create({
              id: folder.id,
              username: folder.username,
              name: folder.name,
              icon: folder.icon,
              color: folder.color,
              position: folder.position || 0
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not add folder ${folder.name} to local:`, error);
        }
      }
      
      // Add any new tags
      for (const tag of mergedData.tags || []) {
        try {
          const existingTags = await studyTag.filter({ id: tag.id });
          if (!existingTags || existingTags.length === 0) {
            await studyTag.create({
              id: tag.id,
              name: tag.name,
              color: tag.color
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not add tag ${tag.name} to local:`, error);
        }
      }
      
      // Add any new moves
      for (const move of mergedData.moves || []) {
        try {
          const existingMoves = await userStudyMove.filter({ id: move.id });
          if (!existingMoves || existingMoves.length === 0) {
            await userStudyMove.create({
              id: move.id,
              study_id: move.study_id,
              fen: move.fen,
              san: move.san,
              uci: move.uci,
              move_number: move.move_number,
              parent_fen: move.parent_fen,
              is_main_line: move.is_main_line,
              is_initial_move: move.is_initial_move,
              evaluation: move.evaluation,
              comment: move.comment,
              arrows: move.arrows,
              highlights: move.highlights,
              created_at: move.created_at
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not add move ${move.san} to local:`, error);
        }
      }
      
      // Add any new annotations
      for (const annotation of mergedData.annotations || []) {
        try {
          const existingAnnotations = await moveAnnotation.filter({ id: annotation.id });
          if (!existingAnnotations || existingAnnotations.length === 0) {
            await moveAnnotation.create({
              id: annotation.id,
              move_id: annotation.move_id,
              type: annotation.type,
              content: annotation.content,
              url: annotation.url,
              created_at: annotation.created_at,
              updated_at: annotation.updated_at
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not add annotation to local:`, error);
        }
      }
      
      // Add any new tags mapping
      for (const mapping of mergedData.tagsMapping || []) {
        try {
          const existingMappings = await studyTagsMapping.filter({ id: mapping.id });
          if (!existingMappings || existingMappings.length === 0) {
            await studyTagsMapping.create({
              id: mapping.id,
              study_id: mapping.study_id,
              tag_id: mapping.tag_id,
              created_at: mapping.created_at
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not add tag mapping to local:`, error);
        }
      }
      
      // Save the database after all updates
      await dbModule.saveDatabase();
      
    } catch (error) {
      console.error('Error updating local database with merged data:', error);
      throw error;
    }
  }

  // Get sync status and info
  get status() {
    return {
      isEnabled: this.isSyncEnabled,
      isSignedIn: googleAuth.isSignedIn
    };
  }
}

// Create singleton instance
export const googleDriveSync = new GoogleDriveSyncService();
export default googleDriveSync;