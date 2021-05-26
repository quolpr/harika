import type { VaultsRepository } from '@harika/web-core';
import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../utils';
import './styles.css';
import { useObservableState } from 'observable-hooks';
import { Link, useHistory } from 'react-router-dom';
import { paths } from '../../paths';
import { PlusIcon } from '@heroicons/react/solid';
import { CreateVaultModal } from './CreateVaultModal';
import { useAuthState } from '../../hooks/useAuthState';
import { Brand } from '../../components/Brand/Brand';
import { generateId } from '@harika/common';
import { deleteFromStorage } from '@rehooks/local-storage';
import DeleteIcon from '@material-ui/icons/Delete';

const vaultsClass = cn('vaults');
const vaultsNavbarClass = cn('vaults-navbar');

export const VaultsPage = ({ vaults }: { vaults: VaultsRepository }) => {
  const history = useHistory();

  const [isCreateModalOpened, setIsCreateModalOpened] = useState(false);
  const allVaultTuples = useMemo(() => vaults.getAllVaultTuples$(), [vaults]);
  const allVaults = useObservableState(allVaultTuples, []);

  const handleSubmit = useCallback(
    async (data: { name: string }) => {
      const dbId = generateId();

      const vault = await vaults.createVault({ name: data.name, dbId });
      if (!vault) {
        console.error('Failed to create vault');

        return;
      }

      setIsCreateModalOpened(false);

      history.push(paths.vaultDailyPath({ vaultId: vault.$modelId }));
    },
    [vaults, history],
  );

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
          {allVaults.map((vault) => (
            <Link
              key={vault.id}
              className={vaultsClass('box')}
              to={paths.vaultDailyPath({ vaultId: vault.id })}
            >
              <div className={vaultsClass('vault-name')}>
                <button
                  className={vaultsClass('trash')}
                  onClick={(e) => {
                    e.preventDefault();

                    if (confirm('Are you sure?')) {
                      vaults.dropVault(vault.id);
                    }
                  }}
                >
                  <DeleteIcon />
                </button>

                {vault.name}
              </div>
            </Link>
          ))}

          <div
            className={`${vaultsClass('box')} ${vaultsClass('create-box')}`}
            onClick={() => setIsCreateModalOpened(true)}
          >
            <div className={vaultsClass('vault-create-title')}>
              Create Vault
            </div>

            <div className={vaultsClass('add-icon')}>
              <PlusIcon style={{ width: 20 }} />
            </div>
          </div>

          <CreateVaultModal
            isOpened={isCreateModalOpened}
            onClose={handleClose}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </>
  );
};

export default VaultsPage;
