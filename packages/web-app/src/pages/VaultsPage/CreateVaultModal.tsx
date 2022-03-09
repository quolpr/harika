import { generateId } from '@harika/web-core';
import React, { ChangeEvent, useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Modal, modalClass } from '../../components/Modal/Modal';
import { useUserVaults } from '../../hooks/useUserApp';
import { paths } from '../../paths';
import { cn, useNavigateRef } from '../../utils';
import { ImportModal } from './ImportModal';

const formModalClass = cn('vault-form-modal');
const formClass = cn('form');

type IFormData = {
  name: string;
};

export const CreateVaultModal = ({
  isOpened,
  onClose,
}: {
  isOpened: boolean;
  onClose: () => void;
}) => {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigateRef();
  const userVaults = useUserVaults();

  const [currentFile, setCurrentFile] = useState<File | undefined>();
  const [vaultName, setVaultName] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    setError,
    getValues,
  } = useForm<IFormData>();

  const { ref: refName, ...restName } = register('name', { required: true });

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      const dbId = generateId();

      const vault = await userVaults?.createVault({ name: data.name, dbId });
      if (!vault) {
        console.error('Failed to create vault');

        return;
      }

      onClose();

      navigate.current(paths.vaultDailyPath({ vaultId: vault.id }));
    },
    [userVaults, onClose, navigate],
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.item(0);

      if (!file) {
        setError('name', { message: 'Failed to load file' });

        return;
      }

      setCurrentFile(file);
      setVaultName(getValues('name'));
    },
    [getValues, setError],
  );

  const handleJsonImportClick = useCallback(async () => {
    if (!(await trigger())) return;

    inputFileRef.current?.click();
  }, [trigger]);

  return (
    <Modal isOpened={isOpened} onClose={onClose}>
      {currentFile && vaultName ? (
        <ImportModal file={currentFile} vaultName={vaultName} />
      ) : (
        <>
          <h1
            className={`${formModalClass('header')} ${modalClass('header')} `}
          >
            New Vault
          </h1>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className={`${modalClass('row')} ${modalClass(
              'footer',
            )} ${formClass()}`}
          >
            <label htmlFor="name" className={formClass('label')}>
              Name
            </label>
            <input
              {...restName}
              type="text"
              placeholder="Vault Name"
              name="name"
              ref={(el) => {
                el?.focus();
                refName(el);
              }}
              className={formClass('input')}
            />

            {errors.name && errors.name.type === 'required' && (
              <span className={formClass('error')}>Name is required</span>
            )}

            <input type="submit" className={formClass('submit-btn')} />

            <button
              className={formClass('submit-btn', { secondary: true })}
              type="button"
              onClick={handleJsonImportClick}
            >
              Import json
            </button>
          </form>
        </>
      )}

      <input
        type="file"
        ref={inputFileRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept=".json"
      />
    </Modal>
  );
};
