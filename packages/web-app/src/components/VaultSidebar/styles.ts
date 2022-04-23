import { Link } from 'react-router-dom';
import { css, styled } from 'twin.macro';

export const SidebarItem = styled(Link)<{ isActive?: boolean }>`
  height: 28px;

  display: flex;
  align-items: center;

  font-size: 16px;

  transition: color 0.25s ease;

  color: #a9a9a9;

  cursor: pointer;

  &:hover {
    color: #d7d7d7;
  }

  ${({ isActive }) =>
    isActive &&
    css`
      font-weight: bold;
      font-size: 16px;
      color: #e4e4e4;
    `}
`;

export const SidebarItemBtn = SidebarItem.withComponent('button');
export const SidebarItemLabel = SidebarItem.withComponent('label');
export const SidebarItemDiv = SidebarItem.withComponent('label');
