import './styles.css';

import clsx from 'clsx';
import React from 'react';

export const Arrow = ({
  isExpanded,
  onToggle,
  className,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}) => {
  return (
    <button
      className={clsx(className, 'arrow', {
        'arrow--expanded': isExpanded,
      })}
      onClick={() => {
        onToggle();
      }}
      aria-expanded={isExpanded}
      aria-label="Expand block"
    />
  );
};
