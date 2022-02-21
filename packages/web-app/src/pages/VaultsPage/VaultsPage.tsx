import './styles.css';

import { generateId, UserVaultsService } from '@harika/web-core';
import { PlusIcon } from '@heroicons/react/solid';
import SettingsIcon from '@material-ui/icons/Settings';
import { deleteFromStorage } from '@rehooks/local-storage';
import { useObservableState } from 'observable-hooks';
import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { of } from 'rxjs';

import { Brand } from '../../components/Brand/Brand';
import { useAuthState } from '../../hooks/useAuthState';
import { useLoadUserApp, useUserVaults } from '../../hooks/useUserApp';
import { paths } from '../../paths';
import { cn, useNavigateRef } from '../../utils';
import { CreateVaultModal } from './CreateVaultModal';
import { SettingsModal } from './SettingsModal';

const vaultsClass = cn('vaults');
const vaultsNavbarClass = cn('vaults-navbar');

const VaultBlock = ({
  vault,
  vaultsService: vaults,
}: {
  vault: { id: string; name: string };
  vaultsService: UserVaultsService;
}) => {
  const [isOpened, setIsOpened] = useState(false);

  return (
    <>
      <Link
        key={vault.id}
        className={vaultsClass('box')}
        to={paths.vaultDailyPath({ vaultId: vault.id })}
      >
        <div className={vaultsClass('vault-name')}>
          <button
            className={vaultsClass('settings')}
            onClick={(e) => {
              e.preventDefault();
              setIsOpened(true);
            }}
          >
            <SettingsIcon />
          </button>

          {vault.name}
        </div>
      </Link>
      <SettingsModal
        isOpened={isOpened}
        setIsOpened={setIsOpened}
        vaultsService={vaults}
        vault={vault}
      />
    </>
  );
};

export const VaultsPage = () => {
  useLoadUserApp();

  const userVaults = useUserVaults();

  const [isCreateModalOpened, setIsCreateModalOpened] = useState(false);
  const allVaultTuples = useMemo(
    () => userVaults?.getAllVaultTuples$() || of([]),
    [userVaults],
  );
  const allVaults = useObservableState(allVaultTuples, []);

  const handleClose = useCallback(() => {
    setIsCreateModalOpened(false);
  }, []);

  const [, setAuthInfo] = useAuthState();

  return (
    <>
      <div className={vaultsNavbarClass()}>
        <Brand />

        <button
          className={vaultsNavbarClass('logout')}
          onClick={() => {
            setAuthInfo(undefined);
            deleteFromStorage('lastVaultId');
          }}
        >
          Log Out
        </button>
      </div>

      <div className="vaults-container">
        <div className={vaultsClass()}>
          {allVaults.map(
            (vault) =>
              userVaults && (
                <VaultBlock
                  key={vault.id}
                  vault={vault}
                  vaultsService={userVaults}
                />
              ),
          )}

          <button
            className={`${vaultsClass('box')} ${vaultsClass('create-box')}`}
            onClick={() => setIsCreateModalOpened(true)}
          >
            <div className={vaultsClass('vault-create-title')}>
              Create Vault
            </div>

            <div className={vaultsClass('add-icon')}>
              <PlusIcon style={{ width: 20 }} />
            </div>
          </button>

          <CreateVaultModal
            isOpened={isCreateModalOpened}
            onClose={handleClose}
          />
        </div>
      </div>
    </>
  );
};

export default VaultsPage;
