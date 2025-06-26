// ChessScope integrations
// Since we're now using local SQLite database, we don't need external integrations
// These can be implemented later if needed for specific features

export const Core = {
  // Placeholder for future local integrations
  InvokeLLM: async () => { throw new Error('LLM integration not implemented in local version'); },
  SendEmail: async () => { throw new Error('Email integration not implemented in local version'); },
  UploadFile: async () => { throw new Error('File upload integration not implemented in local version'); },
  GenerateImage: async () => { throw new Error('Image generation not implemented in local version'); },
  ExtractDataFromUploadedFile: async () => { throw new Error('File extraction not implemented in local version'); }
};

// Re-export for backwards compatibility
export const InvokeLLM = Core.InvokeLLM;
export const SendEmail = Core.SendEmail;
export const UploadFile = Core.UploadFile;
export const GenerateImage = Core.GenerateImage;
export const ExtractDataFromUploadedFile = Core.ExtractDataFromUploadedFile;






