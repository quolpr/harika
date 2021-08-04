import React from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { cn } from '../../utils';
import { Brand } from '../Brand/Brand';
import { useCallback } from 'react';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import dayjs from 'dayjs';
import download from 'downloadjs';
import VaultIcon from './vault.svgr.svg';
import DailyNoteIcon from '../../icons/daily-note.svgr.svg';
import NotesIcon from '../../icons/notes.svgr.svg';

const sidebarClass = cn('sidebar');

type IProps = {
  className?: string;
  isOpened: boolean;
  onNavClick: (e: React.MouseEvent) => void;
};

export const VaultSidebar = React.forwardRef<HTMLDivElement, IProps>(
  ({ className, isOpened, onNavClick }: IProps, ref) => {
    const vault = useCurrentVault();
    const notesRepository = useNoteRepository();

    const handleDownloadClick = useCallback(async () => {
      const blob = await notesRepository.export();

      download(
        blob,
        `${vault.name
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()}-${dayjs().format('DD-MM-YYYY')}.json`,
        'application/json',
      );
    }, [notesRepository, vault.name]);

    const handleImport = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const reader = new FileReader();
        reader.onload = (eReader) => {
          if (!eReader?.target?.result) return;

          try {
            const result = JSON.parse(eReader.target.result.toString());

            notesRepository.import(result);
          } catch (e) {
            alert('Failed to import db');
          }
        };
        reader.readAsText(e.target.files[0]);
      },
      [notesRepository],
    );

    return (
      <div
        ref={ref}
        className={`${sidebarClass({ isOpened: isOpened })} ${className}`}
      >
        <div className={sidebarClass('header')}>
          <div className={sidebarClass('header-vault-icon')}>
            <VaultIcon />
          </div>
          <div className={sidebarClass('header-vault-name')}>{vault.name}</div>
        </div>
        <div className={sidebarClass('menu')}>
          <Link
            className={sidebarClass('menu-link')}
            to={paths.vaultDailyPath({ vaultId: vault.$modelId })}
            onClick={onNavClick}
          >
            <div className={sidebarClass('menu-link-icon')}>
              <DailyNoteIcon />
            </div>

            <div className={sidebarClass('menu-link-title')}>Daily Note</div>
          </Link>

          <Link
            className={sidebarClass('menu-link')}
            to={paths.vaultNoteIndexPath({ vaultId: vault.$modelId })}
            onClick={onNavClick}
          >
            <div className={sidebarClass('menu-link-icon')}>
              <NotesIcon />
            </div>

            <div className={sidebarClass('menu-link-title')}>All Notes</div>
          </Link>
        </div>

        <div style={{ display: 'none' }}>
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

            <button
              className={sidebarClass('link')}
              onClick={handleDownloadClick}
            >
              Download db
            </button>

            <label className={sidebarClass('link')}>
              <input
                id="upload"
                type="file"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
              Import DB
            </label>
          </div>
        </div>

        <Brand className={sidebarClass('brand')} onClick={onNavClick} />
      </div>
    );
  },
);
