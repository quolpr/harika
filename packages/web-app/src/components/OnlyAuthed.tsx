import React from 'react';
import { Redirect } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { paths } from '../paths';

export const OnlyAuthed: React.FC = ({ children }) => {
  const [authInfo] = useAuthState();

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{authInfo ? children : <Redirect to={paths.loginPath()} />}</>;
};
