import React, { useRef, useEffect } from 'react';
import { CANVAS_CONFIG } from './constants.js';

/**
 * Context menu component for canvas nodes
 * @param {Object} props - Component props
 * @param {Object} props.contextMenu - Context menu state { x, y, node }
 * @param {Array} props.contextMenuActions - Array of action objects
 * @param {Object} props.dimensions - Canvas dimensions
 * @param {Function} props.onActionClick - Action click handler
 * @param {Function} props.onClose - Close handler
 */
const ContextMenu = ({ 
  contextMenu, 
  contextMenuActions, 
  dimensions, 
  onActionClick, 
  onClose 
}) => {
  const contextMenuRef = useRef(null);

  // Handle outside click and keyboard events
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (contextMenu && contextMenuRef.current) {
        // Don't close if clicking on the context menu itself
        if (contextMenuRef.current.contains(e.target)) {
          return;
        }
        
        // Close the context menu for any other click
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (contextMenu) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            onClose();
            break;
          case 'Enter':
            e.preventDefault();
            // Execute first non-disabled action
            if (contextMenuActions && contextMenuActions.length > 0) {
              const firstEnabledAction = contextMenuActions.find(action => 
                !action.disabled || !action.disabled(contextMenu.node)
              );
              if (firstEnabledAction) {
                onActionClick(firstEnabledAction, contextMenu.node);
              }
            }
            break;
          // Note: Arrow key navigation could be added here for more complex menus
        }
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu, contextMenuActions, onActionClick, onClose]);

  if (!contextMenu || !contextMenuActions || contextMenuActions.length === 0) {
    return null;
  }

  return (
    <div
      ref={contextMenuRef}
      className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
      style={{
        left: Math.min(contextMenu.x, dimensions.width - CANVAS_CONFIG.CONTEXT_MENU_OFFSET), // Prevent menu from going off-screen
        top: Math.min(contextMenu.y, dimensions.height - (contextMenuActions.length * CANVAS_CONFIG.CONTEXT_MENU_ITEM_HEIGHT + CANVAS_CONFIG.CONTEXT_MENU_PADDING)), // Prevent menu from going off-screen
      }}
    >
      {contextMenuActions.map((action, index) => {
        const isDisabled = action.disabled ? action.disabled(contextMenu.node) : false;
        
        return (
          <button
            key={index}
            onClick={() => !isDisabled && onActionClick(action, contextMenu.node)}
            disabled={isDisabled}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
              isDisabled 
                ? 'text-slate-500 cursor-not-allowed' 
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {action.icon && <action.icon className="w-4 h-4" />}
            {action.label}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu; 