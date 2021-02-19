import React, { useCallback, useRef } from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { cn } from '../../utils';
import { useClickAway, useMedia } from 'react-use';

const sidebarClass = cn('sidebar');

type IProps = {
  className?: string;
  isOpened: boolean;
  onNavClick: (e: React.MouseEvent) => void;
};

export const VaultSidebar = React.forwardRef<HTMLDivElement, IProps>(
  ({ className, isOpened, onNavClick }: IProps, ref) => {
    const vault = useCurrentVault();

    return (
      <div
        ref={ref}
        className={`${sidebarClass({ isOpened: isOpened })} ${className}`}
      >
        <div className={sidebarClass('links')}>
          <Link
            className={sidebarClass('link')}
            to={paths.vaultDailyPath({ vaultId: vault.$modelId })}
            onClick={onNavClick}
          >
            Daily note
          </Link>

          <Link
            className={sidebarClass('link')}
            to={paths.vaultNoteIndexPath({ vaultId: vault.$modelId })}
            onClick={onNavClick}
          >
            All Notes
          </Link>

          <Link
            className={sidebarClass('link')}
            to={paths.vaultIndexPath()}
            onClick={onNavClick}
          >
            Vaults
          </Link>
        </div>

        <div className={sidebarClass('brand')}>
          <Link to={paths.defaultPath()} onClick={onNavClick}>
            Harika<div className="sidebar__brand-dot">.</div>
          </Link>
        </div>
      </div>
    );
  }
);
