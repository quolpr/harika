import React from 'react';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { cn } from '../../utils';
import './brand.css';

const brandClass = cn('brand');

export const Brand = ({
  onClick,
  className,
  sm,
}: {
  onClick?: (e: React.MouseEvent<Element, MouseEvent>) => void;
  className?: string;
  sm?: boolean;
}) => {
  return (
    <div className={`${brandClass({ sm })} ${className || ''}`}>
      <Link to={paths.defaultPath()} onClick={onClick}>
        Harika<div className={brandClass('dot', { sm })}>.</div>
      </Link>
    </div>
  );
};
