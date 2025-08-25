import PropTypes from 'prop-types';

/**
 * PanelHeaderWrapper - A simple wrapper that provides consistent header styling
 * Just provides the bluish background and styling - children provide the content
 */
const PanelHeaderWrapper = ({ children, className = "" }) => {
  return (
    <div className={`w-full bg-card/50 dark:bg-zinc-800/40 backdrop-blur-sm border-b border-border/30 dark:border-zinc-700/30 ${className}`}>
      {children}
    </div>
  );
};

PanelHeaderWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

export default PanelHeaderWrapper;