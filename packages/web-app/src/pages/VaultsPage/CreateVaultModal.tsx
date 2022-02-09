import React from 'react';
import { useForm } from 'react-hook-form';

import { Modal, modalClass } from '../../components/Modal/Modal';
import { cn } from '../../utils';

const formModalClass = cn('vault-form-modal');
const formClass = cn('form');

type IFormData = {
  name: string;
};

export const CreateVaultModal = ({
  isOpened,
  onClose,
  onSubmit,
}: {
  isOpened: boolean;
  onClose: () => void;
  onSubmit: (data: IFormData) => void;
}) => {
  const {
    register,
    handleSubmit,

    formState: { errors },
  } = useForm<IFormData>();

  const { ref: refName, ...restName } = register('name', { required: true });

  return (
    <Modal isOpened={isOpened} onClose={onClose}>
      <h1 className={`${formModalClass('header')} ${modalClass('header')} `}>
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
      </form>
    </Modal>
  );
};
