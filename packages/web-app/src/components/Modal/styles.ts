import tw, { css, styled } from 'twin.macro';

export const ModalHeader = styled.header`
  ${tw`px-8 mt-2`}
`;

export const modalRowCss = css`
  ${tw`mx-9`}
`;

export const ModalRow = styled.div`
  ${modalRowCss}
`;

export const modalFooterCss = css`
  ${tw`mb-8`}
`;

export const ModalFooter = styled.div`
  ${modalFooterCss}
`;
