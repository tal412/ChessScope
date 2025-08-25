import React from 'react';
import PanelHeaderWrapper from './panel-header-wrapper';
import PropTypes from 'prop-types';

const PanelHeader = ({ 
  title = null, 
  leftContent = null, 
  rightContent = null, 
  children = null,
  className = "" 
}) => {
  return (
    <PanelHeaderWrapper className={className}>
      <div className="px-3 py-2">
        {/* If no title, let rightContent/children take full width */}
        {!title && !leftContent ? (
          <div className="w-full">
            {rightContent}
            {children}
          </div>
        ) : (
          /* Standard layout with title and right content */
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              {title && (
                <div className="text-foreground text-sm leading-tight line-clamp-2 font-semibold" title={title}>
                  {title}
                </div>
              )}
              {leftContent}
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {rightContent}
              {children}
            </div>
          </div>
        )}
      </div>
    </PanelHeaderWrapper>
  );
};

PanelHeader.propTypes = {
  title: PropTypes.string,
  leftContent: PropTypes.node,
  rightContent: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string
};

export default PanelHeader;