import React from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthState } from '../hooks/useAuthState';
import { paths } from '../paths';

export const OnlyAuthed: React.FC = ({ children }) => {
  const [authInfo] = useAuthState();

  return (
    <>{authInfo ? children : <Navigate to={paths.loginPath()} replace />}</>
  );
};
