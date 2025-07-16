# ChessScope

A chess opening analysis application that helps you understand and improve your opening repertoire.

## Features

- Import games from Chess.com
- Analyze your opening performance
- Visual opening tree exploration
- Local SQLite database for all your data
- Performance statistics and insights

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the local development URL

4. Import your Chess.com games to start analyzing your openings

## Architecture

ChessScope features a modern, component-based architecture built with React and Vite. Key architectural highlights:

### Shared Chess Analysis System
- **ChessAnalysisView**: A unified component that powers both Performance Graph and Opening Editor pages
- **Flexible Layout System**: Responsive, configurable layouts that adapt to different screen sizes and component combinations
- **Unified State Management**: Shared hooks for canvas state and chessboard synchronization across all analysis modes

See [CHESS_ANALYSIS_VIEW_README.md](./CHESS_ANALYSIS_VIEW_README.md) for detailed documentation on the shared analysis architecture.

### Data Storage
ChessScope uses a local SQLite database to store your chess games and opening analysis. All data is stored locally on your machine for privacy and offline access.

### Recent Improvements
- **Major Refactor (2024)**: Eliminated ~80% code duplication between PerformanceGraph and OpeningEditor by creating shared ChessAnalysisView component
- **Enhanced Maintainability**: Centralized chess analysis logic for easier feature development and bug fixes
- **Improved Consistency**: Unified behavior and interaction patterns across all analysis modes

## Support

For questions or issues, please refer to the documentation or open an issue in this repository.