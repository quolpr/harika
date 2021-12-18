import React, { useEffect, useState } from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { cn } from '../../utils';
import { useCallback } from 'react';
import VaultIcon from './vault.svgr.svg?component';
import DailyNoteIcon from '../../icons/daily-note.svgr.svg?component';
import NotesIcon from '../../icons/notes.svgr.svg?component';
import UploadIcon from '../../icons/upload.svgr.svg?component';
import DownloadIcon from '../../icons/download.svgr.svg?component';
import { NotesTree } from './NotesTree';
import download from 'downloadjs';
import dayjs from 'dayjs';
import { useObservable, useObservableState } from 'observable-hooks';
import { switchMap } from 'rxjs';
import {
  useCurrentVaultApp,
  useNotesService,
  useVaultService,
} from '../../hooks/vaultAppHooks';
import { CustomScrollbar } from '../CustomScrollbar';
import { ResizeActionType, Resizer } from './Resizer';
import { useMedia } from 'react-use';
import { useHandleNoteClickOrPress } from '../../contexts/StackedNotesContext';

export const sidebarClass = cn('sidebar');

type IProps = {
  className?: string;
  isOpened: boolean;
  onNavClick: (e: React.MouseEvent) => void;
  vaultName: string | undefined;
};

export const getLocalStorageSidebarWidth = () => {
  return parseInt(localStorage.getItem('sidebarWidth') || '260', 10);
};

export const VaultSidebar = React.forwardRef<HTMLDivElement, IProps>(
  ({ className, isOpened, onNavClick, vaultName }: IProps, ref) => {
    const vaultApp = useCurrentVaultApp();
    const notesService = useNotesService();
    const vaultService = useVaultService();

    const handleDownloadClick = useCallback(async () => {
      const str = await vaultService.export();

      const bytes = new TextEncoder().encode(str);
      const blob = new Blob([bytes], {
        type: 'application/json;charset=utf-8',
      });

      download(
        blob,
        `${vaultApp
          .getDbName()
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()}-${dayjs().format('DD-MM-YYYY')}.json`,
        'application/json',
      );
    }, [vaultApp, vaultService]);

    const handleImport = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const reader = new FileReader();
        reader.onload = (eReader) => {
          if (!eReader?.target?.result) return;

          try {
            const result = JSON.parse(eReader.target.result.toString());
            vaultService.import(result);
          } catch (e) {
            alert('Failed to import db');
          }
        };
        reader.readAsText(e.target.files[0]);
      },
      [vaultService],
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

    const handleClick = useHandleNoteClickOrPress(dailyNote?.$modelId);

    const onDailyNoteClick = useCallback(
      (e: React.MouseEvent) => {
        handleClick(e);
        onNavClick(e);
      },
      [handleClick, onNavClick],
    );

    const [sidebarWidth, setSidebarWidth] = useState(() => {
      return getLocalStorageSidebarWidth();
    });

    const handleResize = useCallback(
      (newWidth, _newHeight, currentActionType) => {
        let root = document.documentElement;
        if (currentActionType === ResizeActionType.ACTIVATE) {
          root.style.setProperty('--layout-animation', 'none');
        }
        if (currentActionType === ResizeActionType.DEACTIVATE) {
          root.style.removeProperty('--layout-animation');
          return;
        }

        const sidebarWidth = Math.max(Math.min(newWidth, 450), 200);

        root.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
        setSidebarWidth(sidebarWidth);
        localStorage.setItem('sidebarWidth', sidebarWidth.toString());
      },
      [],
    );

    const isWide = useMedia('(min-width: 768px)');
    useEffect(() => {
      const newWidth = isWide ? getLocalStorageSidebarWidth() : 260;
      setSidebarWidth(newWidth);
    }, [isWide]);

    useEffect(() => {
      let root = document.documentElement;
      root.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }, [sidebarWidth]);

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
          <div className={sidebarClass('header-vault-name')}>
            {vaultName || 'Loading...'}
          </div>
        </div>
        <CustomScrollbar>
          <div className={sidebarClass('menu-container')}>
            <div className={sidebarClass('menu')}>
              <Link
                className={sidebarClass('menu-link sidebar-item')}
                to={paths.vaultDailyPath({ vaultId: vaultApp.applicationId })}
                onClick={onDailyNoteClick}
              >
                <div className={sidebarClass('menu-link-icon')}>
                  <DailyNoteIcon />
                </div>

                <div className={sidebarClass('menu-link-title')}>
                  Daily Note
                </div>
              </Link>

              <Link
                className={sidebarClass('menu-link sidebar-item')}
                to={paths.vaultNoteIndexPath({
                  vaultId: vaultApp.applicationId,
                })}
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

                <div className={sidebarClass('menu-link-title')}>
                  Download db
                </div>
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
        </CustomScrollbar>

        {isWide && (
          <Resizer
            currentWidth={sidebarWidth}
            currentHeight={0}
            onResize={handleResize}
          />
        )}
      </div>
    );
  },
);
