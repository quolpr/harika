import React from 'react';
import clsx from 'clsx';
import './styles.css';

export const Arrow = ({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  return (
    <div
      className={clsx('arrow', {
        'arrow--expanded': isExpanded,
      })}
      onClick={() => {
        onToggle();
      }}
    />
  );
};
