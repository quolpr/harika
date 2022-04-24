import { generateId, UserVaultsService } from '@harika/web-core';
import { PlusIcon } from '@heroicons/react/solid';
import SettingsIcon from '@material-ui/icons/Settings';
import { useObservableState } from 'observable-hooks';
import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { of } from 'rxjs';
import tw, { styled } from 'twin.macro';

import { Brand } from '../../components/Brand/Brand';
import { useLogout } from '../../hooks/useAuthState';
import { useLoadUserApp, useUserVaults } from '../../hooks/useUserApp';
import { paths } from '../../paths';
import { cn, useNavigateRef } from '../../utils';
import { CreateVaultModal } from './CreateVaultModal';
import { SettingsModal } from './SettingsModal';

const vaultsClass = cn('vaults');
const vaultsNavbarClass = cn('vaults-navbar');

const VaultsNavbar = styled.div`
  ${tw`bg-gray-800 px-4 py-2`}
  position: absolute;

  top: 0px;
  left: 0px;
  right: 0px;

  display: flex;

  align-items: center;
  justify-content: center;

  width: 100%;
`;

const NavbarLogout = styled.button`
  ${tw`bg-gray-700 py-1 px-3 rounded transition-all text-sm`}

  margin-left: auto;

  &:hover {
    --tw-bg-opacity: 0.85;
  }
`;

const VaultsContainer = styled.div`
  position: absolute;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;

  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  overscroll-behavior: contain;

  overflow: auto;
`;

const VaultsGrid = styled.div`
  ${tw`max-w-screen-md mx-auto mt-10 px-6 grid gap-6`}

  width: 100%;

  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
`;

const VaultBoxLink = styled(Link)`
  ${tw`px-4 py-3 transition-all rounded-xl bg-gray-800 bg-opacity-80 shadow`}
  display: flex;

  position: relative;

  grid-auto-flow: column;

  backdrop-filter: blur(5px);
  min-height: 100px;

  &:hover {
    ${tw`bg-opacity-70`}
  }
`;

const VaultBoxBtn = VaultBoxLink.withComponent('button');

const VaultCreateBox = styled(VaultBoxBtn)`
  cursor: pointer;
  align-items: center;
`;

const VaultName = styled.div`
  ${tw`font-bold`}
`;

const VaultCreateTitle = styled.div`
  ${tw`font-bold`}
`;

const AddIcon = styled.div`
  ${tw`bg-gray-700 p-1`}
  ${tw`bg-opacity-80`}
  margin-left: auto;
  border-radius: 100%;
`;

const SettingsBtn = styled.button`
  ${tw`transition top-2 right-2 text-gray-500 hover:text-gray-600`}

  position: absolute;

  svg {
    ${tw`transition w-6 h-6`}
  }
`;

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
      <VaultBoxLink
        key={vault.id}
        className={vaultsClass('box')}
        to={paths.vaultDailyPath({ vaultId: vault.id })}
      >
        <VaultName className={vaultsClass('vault-name')}>
          <SettingsBtn
            className={vaultsClass('settings')}
            onClick={(e) => {
              e.preventDefault();
              setIsOpened(true);
            }}
          >
            <SettingsIcon />
          </SettingsBtn>

          {vault.name}
        </VaultName>
      </VaultBoxLink>
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

  const navigate = useNavigateRef();
  const userVaults = useUserVaults();

  const [isCreateModalOpened, setIsCreateModalOpened] = useState(false);
  const allVaultTuples = useMemo(
    () => userVaults?.getAllVaultTuples$() || of([]),
    [userVaults],
  );
  const allVaults = useObservableState(allVaultTuples, []);

  const handleSubmit = useCallback(
    async (data: { name: string }) => {
      const dbId = generateId();

      const vault = await userVaults?.createVault({ name: data.name, dbId });
      if (!vault) {
        console.error('Failed to create vault');

        return;
      }

      setIsCreateModalOpened(false);

      navigate.current(paths.vaultDailyPath({ vaultId: vault.id }));
    },
    [userVaults, navigate],
  );

  const handleClose = useCallback(() => {
    setIsCreateModalOpened(false);
  }, []);

  const logout = useLogout();

  return (
    <>
      <VaultsNavbar className={vaultsNavbarClass()}>
        <Brand />

        <NavbarLogout className={vaultsNavbarClass('logout')} onClick={logout}>
          Log Out
        </NavbarLogout>
      </VaultsNavbar>

      <VaultsContainer className="vaults-container">
        <VaultsGrid className={vaultsClass()}>
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

          <VaultCreateBox
            className={`${vaultsClass('box')} ${vaultsClass('create-box')}`}
            onClick={() => setIsCreateModalOpened(true)}
          >
            <VaultCreateTitle className={vaultsClass('vault-create-title')}>
              Create Vault
            </VaultCreateTitle>

            <AddIcon className={vaultsClass('add-icon')}>
              <PlusIcon style={{ width: 20 }} />
            </AddIcon>
          </VaultCreateBox>

          <CreateVaultModal
            isOpened={isCreateModalOpened}
            onClose={handleClose}
            onSubmit={handleSubmit}
          />
        </VaultsGrid>
      </VaultsContainer>
    </>
  );
};

export default VaultsPage;
