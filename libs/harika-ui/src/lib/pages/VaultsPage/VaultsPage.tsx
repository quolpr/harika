import { VaultRepository } from '@harika/harika-core';
import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../utils';
import './styles.css';
import { useObservableState } from 'observable-hooks';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { Plus as PlusIcon } from 'heroicons-react';
import { CreateVaultModal } from './CreateVaultModal';

const vaultsClass = cn('vaults');

export const VaultsPage = ({ vaults }: { vaults: VaultRepository }) => {
  const [isCreateModalOpened, setIsCreateModalOpened] = useState(false);
  const allVaultTuples = useMemo(() => vaults.getAllVaultTuples$(), [vaults]);
  const allVaults = useObservableState(allVaultTuples, []);

  const handleSubmit = useCallback(
    (data: { name: string }) => {
      vaults.createVault({ name: data.name });
      setIsCreateModalOpened(false);
    },
    [vaults]
  );

  const handleClose = useCallback(() => {
    setIsCreateModalOpened(false);
  }, []);

  return (
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
  );
};