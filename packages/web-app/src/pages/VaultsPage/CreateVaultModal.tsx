import React from 'react';
import { useForm } from 'react-hook-form';
import { styled } from 'twin.macro';

import { Modal, modalClass } from '../../components/Modal/Modal';
import { modalFooterCss, modalRowCss } from '../../components/Modal/styles';
import { cn } from '../../utils';
import { VaultModelHeader } from './styles';

const formModalClass = cn('vault-form-modal');
const formClass = cn('form');

type IFormData = {
  name: string;
};

const ModalRowForm = styled.form`
  ${modalRowCss}
  ${modalFooterCss}
`;

export const CreateVaultModal = ({
  isOpened,
  onClose,
  onSubmit,
}: {
  isOpened: boolean;
  onClose: () => void;
  onSubmit: (data: IFormData) => Promise<void>;
}) => {
  const {
    register,
    handleSubmit,

    formState: { errors },
  } = useForm<IFormData>();

  const { ref: refName, ...restName } = register('name', { required: true });

  return (
    <Modal isOpened={isOpened} onClose={onClose}>
      <VaultModelHeader
        className={`${formModalClass('header')} ${modalClass('header')} `}
      >
        New Vault
      </VaultModelHeader>

      <ModalRowForm
        onSubmit={(...args) => void handleSubmit(onSubmit)(...args)}
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
      </ModalRowForm>
    </Modal>
  );
};
