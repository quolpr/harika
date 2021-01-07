import React from 'react';
import clsx from 'clsx';
import './styles.css';

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
    <div
      className={clsx(className, 'arrow', {
        'arrow--expanded': isExpanded,
      })}
      onClick={() => {
        onToggle();
      }}
    />
  );
};
