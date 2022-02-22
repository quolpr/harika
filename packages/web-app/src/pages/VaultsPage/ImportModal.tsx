import {
  generateId,
  roamToHarikaJson,
  VaultApplication,
} from '@harika/web-core';
import { isArray } from 'lodash-es';
import React, { useEffect } from 'react';

import { modalClass } from '../../components/Modal/Modal';
import { useGetSyncToken } from '../../hooks/useGetSyncToken';
import { useUserVaults } from '../../hooks/useUserApp';
import { paths } from '../../paths';
import { cn } from '../../utils';

const formModalClass = cn('vault-form-modal');

export const ImportModal = ({
  file,
  vaultName,
}: {
  file: File;
  vaultName: string;
}) => {
  const userVaults = useUserVaults();
  const getSyncToken = useGetSyncToken();

  useEffect(() => {
    const callback = async () => {
      let data: any | undefined = undefined;

      try {
        data = JSON.parse(await file.text());
      } catch {
        console.error('Failed to parse JSON!');

        return;
      }

      const dump = (() => {
        if (isArray(data)) {
          return roamToHarikaJson(data);
          // we assume it is roam format
        } else {
          // Otherwise harika format
          return data;
        }
      })();

      const vaultId = generateId();
      const vault = await userVaults?.createVault({
        name: vaultName,
        dbId: vaultId,
      });
      if (!vault) {
        console.error('Failed to create vault');

        return;
      }

      const vaultApp = new VaultApplication(
        vaultId,
        import.meta.env.VITE_PUBLIC_WS_URL as string,
        getSyncToken,
      );

      await vaultApp.start();
      await vaultApp.getImportExportService().importData(dump);

      // window.location.pathname = paths.vaultDailyPath({ vaultId: vault.id });
    };

    callback();
  }, [file, getSyncToken, userVaults, vaultName]);

  return (
    <>
      <h1 className={`${formModalClass('header')} ${modalClass('header')} `}>
        Importing
      </h1>
    </>
  );
};
