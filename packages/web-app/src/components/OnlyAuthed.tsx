import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { paths } from '../paths';

export const OnlyAuthed: React.FC = ({ children }) => {
  const [authInfo] = useAuthState();

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return (
    <>{authInfo ? children : <Navigate to={paths.loginPath()} replace />}</>
  );
};
