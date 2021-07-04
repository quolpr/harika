import React from 'react';
import ReactModal from 'react-modal';
import './styles.css';
import { XIcon } from '@heroicons/react/solid';
import { cn } from '../../utils';

export const modalClass = cn('modal');

export const Modal: React.FC<{
  isOpened: boolean;
  onClose: () => void;
  fullHeight?: boolean;
}> = ({ isOpened, onClose, fullHeight, children }) => {
  return (
    <ReactModal
      isOpen={isOpened}
      style={{ overlay: { zIndex: 100000 }, content: {} }}
      overlayClassName={modalClass('overlay')}
      className={modalClass('content', { 'full-height': fullHeight })}
      shouldCloseOnOverlayClick={true}
      onRequestClose={onClose}
    >
      <button className={modalClass('close-btn')} onClick={onClose}>
        <XIcon style={{ width: 17 }} />
      </button>
      {children}
    </ReactModal>
  );
};
