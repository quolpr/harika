import React from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { cn } from '../../utils';
import { useCallback } from 'react';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import dayjs from 'dayjs';
import download from 'downloadjs';
import VaultIcon from './vault.svgr.svg';
import DailyNoteIcon from '../../icons/daily-note.svgr.svg';
import NotesIcon from '../../icons/notes.svgr.svg';
import UploadIcon from '../../icons/upload.svgr.svg';
import DownloadIcon from '../../icons/download.svgr.svg';
import { NotesTree } from './NotesTree';

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
            <Link to={paths.vaultIndexPath()}>
              <VaultIcon />
            </Link>
          </div>
          <div className={sidebarClass('header-vault-name')}>{vault.name}</div>
        </div>
        <div className={sidebarClass('menu-container')}>
          <div className={sidebarClass('menu')}>
            <Link
              className={sidebarClass('menu-link sidebar-item')}
              to={paths.vaultDailyPath({ vaultId: vault.$modelId })}
              onClick={onNavClick}
            >
              <div className={sidebarClass('menu-link-icon')}>
                <DailyNoteIcon />
              </div>

              <div className={sidebarClass('menu-link-title')}>Daily Note</div>
            </Link>

            <Link
              className={sidebarClass('menu-link sidebar-item')}
              to={paths.vaultNoteIndexPath({ vaultId: vault.$modelId })}
              onClick={onNavClick}
            >
              <div className={sidebarClass('menu-link-icon')}>
                <NotesIcon />
              </div>

              <div className={sidebarClass('menu-link-title')}>All Notes</div>
            </Link>

            <button
              className={sidebarClass('menu-link sidebar-item')}
              onClick={handleDownloadClick}
            >
              <div className={sidebarClass('menu-link-icon')}>
                <DownloadIcon />
              </div>

              <div className={sidebarClass('menu-link-title')}>Download db</div>
            </button>

            <label className={sidebarClass('menu-link sidebar-item')}>
              <input
                id="upload"
                type="file"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
              <div className={sidebarClass('menu-link-icon')}>
                <UploadIcon />
              </div>

              <div className={sidebarClass('menu-link-title')}>Import DB</div>
            </label>
          </div>

          <div className={sidebarClass('notes-tree-title')}>Notes Tree</div>

          <div className={sidebarClass('notes-tree')}>
            <NotesTree onNavClick={onNavClick} />
          </div>

          {/* <Brand className={sidebarClass('brand')} onClick={onNavClick} /> */}
        </div>
      </div>
    );
  },
);
