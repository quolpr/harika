import { VaultsRepository } from '@harika/harika-core';
import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../utils';
import './styles.css';
import { useObservableState } from 'observable-hooks';
import { Link, useHistory } from 'react-router-dom';
import { paths } from '../../paths';
import { Plus as PlusIcon } from 'heroicons-react';
import { CreateVaultModal } from './CreateVaultModal';
import { useAuthState } from '../../hooks/useAuthState';
import { Brand } from '../../components/Brand/Brand';
import { useCreateVaultMutation } from '../../generated/graphql';
import { generateId } from '@harika/harika-core';
import { v4 } from 'uuid';

const vaultsClass = cn('vaults');
const vaultsNavbarClass = cn('vaults-navbar');

export const VaultsPage = ({ vaults }: { vaults: VaultsRepository }) => {
  const [authInfo] = useAuthState();
  const isOffline =
    authInfo?.isOffline === undefined ? true : authInfo?.isOffline;

  const createRemoteVault = useCreateVaultMutation();

  const history = useHistory();

  const [isCreateModalOpened, setIsCreateModalOpened] = useState(false);
  const allVaultTuples = useMemo(() => vaults.getAllVaultTuples$(), [vaults]);
  const allVaults = useObservableState(allVaultTuples, []);

  const handleSubmit = useCallback(
    async (data: { name: string }) => {
      const dbId = v4();

      if (!isOffline) {
        const res = await createRemoteVault.mutateAsync({
          id: dbId,
          name: data.name,
        });

        if (!res.createVault) {
          console.error('Failed to create vault - failed to create remote DB');

          return;
        }
      }

      const vault = await vaults.createVault({ name: data.name, dbId });
      if (!vault) {
        console.error('Failed to create vault');

        return;
      }

      setIsCreateModalOpened(false);

      history.push(paths.vaultDailyPath({ vaultId: vault.$modelId }));
    },
    [isOffline, vaults, history, createRemoteVault]
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
          }}
        >
          Log Out
        </button>
      </div>

      <div className={vaultsClass()}>
        {allVaults.map((vault) => (
          <Link
            key={vault.id}
            className={vaultsClass('box')}
            to={paths.vaultDailyPath({ vaultId: vault.id })}
          >
            <div className={vaultsClass('vault-name')}>{vault.name}</div>
          </Link>
        ))}

        <div
          className={`${vaultsClass('box')} ${vaultsClass('create-box')}`}
          onClick={() => setIsCreateModalOpened(true)}
        >
          <div className={vaultsClass('vault-create-title')}>Create Vault</div>

          <div className={vaultsClass('add-icon')}>
            <PlusIcon />
          </div>
        </div>

        <CreateVaultModal
          isOpened={isCreateModalOpened}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      </div>
    </>
  );
};
