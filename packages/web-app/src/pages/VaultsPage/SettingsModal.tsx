import { UserVaultsService } from '@harika/web-core';
import DeleteIcon from '@material-ui/icons/Delete';
import React, { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { Modal, modalClass } from '../../components/Modal/Modal';
import { cn } from '../../utils';

const formModalClass = cn('vault-form-modal');
const formClass = cn('form');

type IFormData = {
  name: string;
};

export const SettingsModal = ({
  vault,
  vaultsService: vaults,
  isOpened,
  setIsOpened,
}: {
  vault: { id: string; name: string };
  vaultsService: UserVaultsService;
  isOpened: boolean;
  setIsOpened: (t: boolean) => void;
}) => {
  const handleClose = useCallback(() => {
    setIsOpened(false);
  }, [setIsOpened]);

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
  } = useForm<IFormData>({ defaultValues: { name: vault.name } });

  const { ref: refName, ...restName } = register('name', { required: true });

  const handleSubmit = useCallback(
    async (data: { name: string }) => {
      if (!(await vaults.renameVault(vault.id, data.name))) {
        alert('Failed to rename');
      }

      setIsOpened(false);
    },
    [vaults, vault.id, setIsOpened],
  );

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure?')) {
      vaults.dropVault(vault.id);
    }
  }, [vault.id, vaults]);

  return (
    <Modal isOpened={isOpened} onClose={handleClose}>
      <h1 className={`${formModalClass('header')} ${modalClass('header')} `}>
        Edit Vault
      </h1>

      <form
        onSubmit={handleFormSubmit(handleSubmit)}
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
      </form>

      <button
        onClick={handleDelete}
        className={`${formClass('submit-btn', {
          dangerous: true,
        })} mt-2 rounded-none`}
      >
        <DeleteIcon className="mb-1 mr-1.5" />
        Delete
      </button>
    </Modal>
  );
};
