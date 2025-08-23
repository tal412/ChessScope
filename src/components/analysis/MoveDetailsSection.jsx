import React from 'react';
import { LayoutSection } from '@/components/ui/flexible-layout';
import MoveDetailsPanel from './MoveDetailsPanel';

/**
 * MoveDetailsSection - A wrapper component that integrates MoveDetailsPanel
 * with the ChessAnalysisView's flexible layout system
 */
const MoveDetailsSection = ({
  selectedNode = null,
  onUpdateNode = null,
  onSetMainLine = null,
  onSetInitialMove = null,
  moveTree = null,
  drawingMode = false,
  onDrawingModeToggle = null,
  readOnly = false,
  className = ""
}) => {
  return (
    <LayoutSection
      key="details"
      className={`bg-column-primary border-l-2 border-primary/20 border-r-0 ${className}`}
    >
      <div className="h-full">
        <MoveDetailsPanel
          selectedNode={selectedNode}
          onUpdateNode={onUpdateNode}
          onSetMainLine={onSetMainLine}
          onSetInitialMove={onSetInitialMove}
          moveTree={moveTree}
          drawingMode={drawingMode}
          onDrawingModeToggle={onDrawingModeToggle}
          readOnly={readOnly}
        />
      </div>
    </LayoutSection>
  );
};

export default MoveDetailsSection; 