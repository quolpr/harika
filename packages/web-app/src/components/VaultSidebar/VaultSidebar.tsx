import React from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { useCurrentVaultApp } from '../../hooks/useCurrentVault';
import { cn } from '../../utils';
import { useCallback } from 'react';
import VaultIcon from './vault.svgr.svg?component';
import DailyNoteIcon from '../../icons/daily-note.svgr.svg?component';
import NotesIcon from '../../icons/notes.svgr.svg?component';
import UploadIcon from '../../icons/upload.svgr.svg?component';
import DownloadIcon from '../../icons/download.svgr.svg?component';
import { NotesTree } from './NotesTree';
import { useVaultService } from '../../contexts/CurrentNotesServiceContext';
import download from 'downloadjs';
import dayjs from 'dayjs';
import { useObservable, useObservableState } from 'observable-hooks';
import { switchMap } from 'rxjs';
import { useHandleClick } from '../../hooks/useNoteClick';
import { usePrimaryNoteId } from '../../hooks/usePrimaryNote';

const sidebarClass = cn('sidebar');

type IProps = {
  className?: string;
  isOpened: boolean;
  onNavClick: (e: React.MouseEvent) => void;
};

export const VaultSidebar = React.forwardRef<HTMLDivElement, IProps>(
  ({ className, isOpened, onNavClick }: IProps, ref) => {
    const vault = useCurrentVaultApp();
    const notesService = useVaultService();
    const primaryNoteId = usePrimaryNoteId();

    const handleDownloadClick = useCallback(async () => {
      const str = await notesService.export();

      const bytes = new TextEncoder().encode(str);
      const blob = new Blob([bytes], {
        type: 'application/json;charset=utf-8',
      });

      download(
        blob,
        `${vault.name
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()}-${dayjs().format('DD-MM-YYYY')}.json`,
        'application/json',
      );
    }, [notesService, vault.name]);

    const handleImport = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const reader = new FileReader();
        reader.onload = (eReader) => {
          if (!eReader?.target?.result) return;

          try {
            const result = JSON.parse(eReader.target.result.toString());
            notesService.import(result);
          } catch (e) {
            alert('Failed to import db');
          }
        };
        reader.readAsText(e.target.files[0]);
      },
      [notesService],
    );

    const dailyNote$ = useObservable(
      (args$) => {
        return args$.pipe(
          switchMap(([notesService]) => notesService.getTodayDailyNote$()),
        );
      },
      [notesService],
    );
    const dailyNote = useObservableState(dailyNote$, undefined);

    const handleClick = useHandleClick(
      vault,
      primaryNoteId,
      dailyNote?.$modelId,
    );

    const onDailyNoteClick = useCallback(
      (e: React.MouseEvent) => {
        handleClick(e);
        onNavClick(e);
      },
      [handleClick, onNavClick],
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
              onClick={onDailyNoteClick}
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
