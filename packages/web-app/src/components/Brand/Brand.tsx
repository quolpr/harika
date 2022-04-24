import React from 'react';
import { Link } from 'react-router-dom';
import tw, { css, styled } from 'twin.macro';

import { paths } from '../../paths';
import { bem } from '../../utils';

const brandClass = bem('brand');

const BrandStyled = styled.div<{ sm?: boolean }>`
  ${tw`text-gray-100 text-3xl font-bold`}

  display: flex;

  margin-top: auto;

  ${({ sm }) =>
    sm &&
    css`
      ${tw`text-2xl`}
    `}
`;

const Dot = styled.div`
  ${tw`inline text-pink-600 ml-0.5`}
`;

export const Brand = ({
  onClick,
  className,
  sm,
}: {
  onClick?: (e: React.MouseEvent<Element, MouseEvent>) => void;
  className?: string;
  sm?: boolean;
}) => {
  return (
    <BrandStyled sm={sm} className={`${brandClass({ sm })} ${className || ''}`}>
      <Link to={paths.defaultPath()} onClick={onClick}>
        Harika<Dot className={brandClass('dot', { sm })}>.</Dot>
      </Link>
    </BrandStyled>
  );
};
