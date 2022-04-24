import clsx from 'clsx';
import React from 'react';
import tw, { css, styled } from 'twin.macro';

const ArrowBtnStyled = styled.button<{ expanded: boolean }>`
  ${tw`cursor-pointer duration-300 outline-none focus:outline-none focus:border-pink-600`}

  &:before {
    ${tw`border-gray-500`}

    display: inline-block;
    content: '';

    border-style: solid;
    border-width: 0 1px 1px 0;

    padding: 2px;
    margin-top: 5px;
    margin-left: 2px;

    transition: border-color 0.3s ease-out, transform 0.2s ease-out;

    transform: rotate(-45deg);
  }

  &:hover:before,
  &:focus:before {
    ${tw`border-pink-600`}
  }

  ${({ expanded }) =>
    expanded &&
    css`
      transform: translateY(-0.3rem) translateX(0.1rem);

      &:before {
        transform: rotate(45deg);
      }
    `}
`;

export const Arrow = ({
  isExpanded,
  onToggle,
  className,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}) => {
  return (
    <ArrowBtnStyled
      className={clsx(className, 'arrow', {
        'arrow--expanded': isExpanded,
      })}
      onClick={() => {
        onToggle();
      }}
      aria-expanded={isExpanded}
      aria-label="Expand block"
      expanded={isExpanded}
    />
  );
};
