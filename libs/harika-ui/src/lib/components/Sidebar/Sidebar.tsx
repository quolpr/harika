import React from 'react';
import clsx from 'clsx';
import './styles.css';
import { Link } from 'react-router-dom';
import { useCurrentVault } from '@harika/harika-utils';
import { paths } from '../../paths';

export const Sidebar = ({
  className,
  isOpened,
}: {
  className?: string;
  isOpened: boolean;
}) => {
  const vault = useCurrentVault();

  return (
    <div
      className={clsx('sidebar', { 'sidebar--is-opened': isOpened }, className)}
    >
      <div className="sidebar__links">
        <Link
          className="sidebar__link"
          to={paths.vaultDailyPath({ vaultId: vault.$modelId })}
        >
          Daily note
        </Link>

        <Link
          className="sidebar__link"
          to={paths.vaultNoteIndexPath({ vaultId: vault.$modelId })}
        >
          All Notes
        </Link>

        <Link className="sidebar__link" to={paths.vaultIndexPath()}>
          Vaults
        </Link>
      </div>

      <div className="sidebar__brand">
        <Link to={paths.defaultPath()}>
          Harika<div className="sidebar__brand-dot">.</div>
        </Link>
      </div>
    </div>
  );
};
