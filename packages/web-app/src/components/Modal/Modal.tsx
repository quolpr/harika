import { XIcon } from '@heroicons/react/solid';
import React from 'react';
import ReactModal from 'react-modal';
import { createGlobalStyle } from 'styled-components';
import tw, { css, styled } from 'twin.macro';

import { cn } from '../../utils';

export const modalClass = cn('modal');

const ReactModalStyled = styled(ReactModal)<{ fullHeight?: boolean }>`
  display: flex;
  flex-direction: column;

  position: relative;

  overflow: auto;
  outline: none;

  width: 100%;
  max-width: 400px;

  ${tw`bg-gray-900 max-w-screen-sm mx-auto rounded-2xl shadow`}
  ${tw`bg-opacity-90`}

  backdrop-filter: blur(5px);

  ${({ fullHeight }) =>
    fullHeight &&
    css`
      height: 100%;
    `}
`;

const ModalCloseBtn = styled.button`
  ${tw`bg-gray-700 p-1 transition-all`}
  ${tw`bg-opacity-80`}
  ${tw`top-4 right-4`}

  position: absolute;

  border-radius: 100%;

  cursor: pointer;

  &:hover {
    ${tw`bg-opacity-70`}
  }
`;

const ModalOverlayStyle = createGlobalStyle`
  .modal__overlay {
    ${tw`bg-gray-600 bg-opacity-30`}

    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    z-index: 110;

    display: flex;
    align-items: center;
    justify-content: center;

    @media (min-width: 640px) {
      padding: 1.5rem;
    }
    @media (min-width: 768px) {
      padding: 10vh;
    }
    @media (min-width: 1024px) {
      padding: 12vh;
    }

    padding: 1rem;
  }
`;

export const Modal: React.FC<{
  isOpened: boolean;
  onClose: () => void;
  fullHeight?: boolean;
}> = ({ isOpened, onClose, fullHeight, children }) => {
  return (
    <>
      <ModalOverlayStyle />
      <ReactModalStyled
        isOpen={isOpened}
        style={{ overlay: { zIndex: 100000 }, content: {} }}
        overlayClassName={modalClass('overlay')}
        className={modalClass('content', { 'full-height': fullHeight })}
        shouldCloseOnOverlayClick={true}
        onRequestClose={onClose}
        fullHeight={fullHeight}
      >
        <ModalCloseBtn className={modalClass('close-btn')} onClick={onClose}>
          <XIcon style={{ width: 17 }} />
        </ModalCloseBtn>
        {children}
      </ReactModalStyled>
    </>
  );
};
