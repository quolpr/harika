import React from 'react';
import clsx from 'clsx';
import './styles.css';
import { Link } from 'react-router-dom';

export const Sidebar = ({
  className,
  isOpened,
}: {
  className?: string;
  isOpened: boolean;
}) => {
  return (
    <div
      className={clsx('sidebar', { 'sidebar--is-opened': isOpened }, className)}
    >
      <div className="sidebar__links">
        <Link className="sidebar__link" to="/">
          Daily note
        </Link>

        <Link className="sidebar__link" to="/notes">
          All Notes
        </Link>
      </div>

      <div className="sidebar__brand">
        <Link to="/">
          Harika<div className="sidebar__brand-dot">.</div>
        </Link>
      </div>
    </div>
  );
};
