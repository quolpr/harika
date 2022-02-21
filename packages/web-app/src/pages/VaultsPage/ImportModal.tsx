import React from 'react';

import { modalClass } from '../../components/Modal/Modal';
import { cn } from '../../utils';

const formModalClass = cn('vault-form-modal');

export const ImportModal = ({
  file,
  vaultName,
}: {
  file: File;
  vaultName: string;
}) => {
  return (
    <>
      <h1 className={`${formModalClass('header')} ${modalClass('header')} `}>
        Importing
      </h1>
    </>
  );
};
