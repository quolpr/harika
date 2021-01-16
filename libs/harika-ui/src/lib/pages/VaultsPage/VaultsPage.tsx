import { HarikaVaults } from '@harika/harika-core';
import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../utils';
import './styles.css';
import { useObservableState } from 'observable-hooks';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';

const vaultsClass = cn('vaults');

const VaultForm = ({
  currentName,
  onSubmit,
}: {
  currentName: string;
  onSubmit: (name: string) => void;
}) => {
  const [vaultName, setVaultName] = useState(currentName);

  return (
    <div className={vaultsClass('box')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(vaultName);
        }}
      >
        <input
          ref={(el) => {
            if (el) el.focus();
          }}
          className={vaultsClass('input')}
          value={vaultName}
          onChange={(e) => {
            setVaultName(e.target.value);
          }}
        />
      </form>
    </div>
  );
};

export const VaultsPage = ({ vaults }: { vaults: HarikaVaults }) => {
  const allVaultTuples = useMemo(() => vaults.getAllVaultTuples$(), [vaults]);
  const allVaults = useObservableState(allVaultTuples, []);

  const [isFormTrigerred, setIsFormTrigerred] = useState(false);
  const handleSubmit = useCallback(
    (name) => {
      vaults.createVault({ name });
      setIsFormTrigerred(false);
    },
    [vaults]
  );

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

      {isFormTrigerred ? (
        <VaultForm currentName="" onSubmit={handleSubmit} />
      ) : (
        <div
          className={vaultsClass('box')}
          onClick={() => setIsFormTrigerred(!isFormTrigerred)}
        >
          Create Vault
        </div>
      )}
    </div>
  );
};
