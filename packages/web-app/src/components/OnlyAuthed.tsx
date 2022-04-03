import React from 'react';
import { useCallback } from 'react';
import EmailPassword, {
  redirectToAuth,
} from 'supertokens-auth-react/recipe/emailpassword';

export const OnlyAuthed: React.FC = ({ children }) => {
  const handleSessionExpired = useCallback(() => {
    redirectToAuth();
  }, []);

  return (
    <EmailPassword.EmailPasswordAuth onSessionExpired={handleSessionExpired}>
      {children}
    </EmailPassword.EmailPasswordAuth>
  );
};
