import { Dump } from '@harika/web-core';
import dayjs from 'dayjs';
import download from 'downloadjs';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useMedia } from 'react-use';
import { switchMap } from 'rxjs';
import { css, styled } from 'twin.macro';

import { useHandleNoteClickOrPress } from '../../contexts/StackedNotesContext';
import {
  useCurrentVaultApp,
  useImportExportService,
  useNoteBlocksService,
} from '../../hooks/vaultAppHooks';
import DailyNoteIcon from '../../icons/daily-note.svgr.svg?component';
import DownloadIcon from '../../icons/download.svgr.svg?component';
import NotesIcon from '../../icons/notes.svgr.svg?component';
import UploadIcon from '../../icons/upload.svgr.svg?component';
import { paths } from '../../paths';
import { cn } from '../../utils';
import { NotesTree } from './NotesTree';
import { ResizeActionType, Resizer } from './Resizer';
import { SidebarItem, SidebarItemBtn, SidebarItemLabel } from './styles';
import VaultIcon from './vault.svgr.svg?component';

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

const VaultSidebarStyled = styled.div<{ closed: boolean }>`
  display: flex;
  flex-direction: column;

  position: fixed;
  width: var(--sidebar-width);
  transition: var(--layout-animation, all 0.15s cubic-bezier(0.4, 0, 0.2, 1));

  height: calc(var(--app-height) - var(--vault-header-full-height));
  top: var(--vault-header-full-height);
  bottom: 0;
  z-index: 1000;

  background-color: #2c2d2f;

  @media (min-width: 768px) {
    height: 100%;
    top: 0 !important;
  }

  ${({ closed }) =>
    closed &&
    css`
      transform: translate3d(calc(var(--sidebar-width) * -1), 0, 0);
    `}
`;

const Header = styled.div`
  display: flex;
  padding: 18px 24px;
  background-color: #353739;
`;

const HeaderVaultName = styled.div`
  margin-left: 14px;

  font-weight: bold;
  color: #e9e9e9;
  font-size: 20px;
`;

const MenuContainer = styled.div`
  overflow: scroll;
`;

const Menu = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  font-family: Roboto;
  font-style: normal;
  font-weight: normal;

  margin: 16px 26px;
  margin-bottom: 12px;
`;

const MenuLinkTitle = styled.div`
  margin-left: 12px;
`;

const NotesTreeContainer = styled.div`
  margin: 0 0 0 12px;
`;

const TreeTitle = styled.div`
  font-family: Roboto;
  font-style: normal;
  font-weight: bold;
  font-size: 13px;
  color: #7e7e88;

  margin-bottom: 8px;
  margin-left: 16px;
`;

export const VaultSidebar = React.forwardRef<HTMLDivElement, IProps>(
  ({ isOpened, onNavClick, vaultName }: IProps, ref) => {
    const vaultApp = useCurrentVaultApp();
    const importExportService = useImportExportService();
    const notesService = useNoteBlocksService();

    const handleDownloadClick = useCallback(async () => {
      const str = await importExportService.exportData();

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
    }, [vaultApp, importExportService]);

    const handleImport = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const reader = new FileReader();
        reader.onload = (eReader) => {
          if (!eReader?.target?.result) return;

          try {
            const result = JSON.parse(eReader.target.result.toString()) as Dump;
            void importExportService.importData(result);
          } catch (e) {
            alert('Failed to import db');
          }
        };
        reader.readAsText(e.target.files[0]);
      },
      [importExportService],
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
      (
        newWidth: number,
        _newHeight: number,
        currentActionType: ResizeActionType,
      ) => {
        const root = document.documentElement;
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
      const root = document.documentElement;
      root.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }, [sidebarWidth]);

    return (
      <VaultSidebarStyled
        ref={ref}
        closed={!isOpened}
        className={sidebarClass({ isOpened: isOpened })}
      >
        <Header className={sidebarClass('header')}>
          <div className={sidebarClass('header-vault-icon')}>
            <Link to={paths.vaultIndexPath()}>
              <VaultIcon />
            </Link>
          </div>
          <HeaderVaultName className={sidebarClass('header-vault-name')}>
            {vaultName || 'Loading...'}
          </HeaderVaultName>
        </Header>
        <MenuContainer className={sidebarClass('menu-container')}>
          <Menu className={sidebarClass('menu')}>
            <SidebarItem
              className={sidebarClass('menu-link sidebar-item')}
              to={paths.vaultDailyPath({ vaultId: vaultApp.applicationId })}
              onClick={onDailyNoteClick}
            >
              <div className={sidebarClass('menu-link-icon')}>
                <DailyNoteIcon />
              </div>

              <MenuLinkTitle className={sidebarClass('menu-link-title')}>
                Daily Note
              </MenuLinkTitle>
            </SidebarItem>

            <SidebarItem
              className={sidebarClass('menu-link sidebar-item')}
              to={paths.vaultNoteIndexPath({
                vaultId: vaultApp.applicationId,
              })}
              onClick={onNavClick}
            >
              <div className={sidebarClass('menu-link-icon')}>
                <NotesIcon />
              </div>

              <MenuLinkTitle className={sidebarClass('menu-link-title')}>
                All Notes
              </MenuLinkTitle>
            </SidebarItem>

            <SidebarItemBtn
              className={sidebarClass('menu-link sidebar-item')}
              onClick={() => void handleDownloadClick()}
            >
              <div className={sidebarClass('menu-link-icon')}>
                <DownloadIcon />
              </div>

              <MenuLinkTitle className={sidebarClass('menu-link-title')}>
                Download db
              </MenuLinkTitle>
            </SidebarItemBtn>

            <SidebarItemLabel
              className={sidebarClass('menu-link sidebar-item')}
            >
              <input
                id="upload"
                type="file"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
              <div className={sidebarClass('menu-link-icon')}>
                <UploadIcon />
              </div>

              <MenuLinkTitle className={sidebarClass('menu-link-title')}>
                Import DB
              </MenuLinkTitle>
            </SidebarItemLabel>
          </Menu>

          <TreeTitle className={sidebarClass('notes-tree-title')}>
            Notes Tree
          </TreeTitle>

          <NotesTreeContainer className={sidebarClass('notes-tree')}>
            <NotesTree onNavClick={onNavClick} />
          </NotesTreeContainer>
        </MenuContainer>

        {isWide && (
          <Resizer
            currentWidth={sidebarWidth}
            currentHeight={0}
            onResize={handleResize}
          />
        )}
      </VaultSidebarStyled>
    );
  },
);
