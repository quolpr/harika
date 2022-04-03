import { writeStorage } from '@rehooks/local-storage';
import EmailPassword from 'supertokens-auth-react/lib/build/recipe/emailpassword/recipe';
import SuperTokens from 'supertokens-auth-react/lib/build/superTokens';
import Session from 'supertokens-auth-react/recipe/session';

import { AuthInfo, authStorageKey } from './hooks/useAuthState';

SuperTokens.init({
  appInfo: {
    // learn more about this on https://supertokens.com/docs/thirdpartyemailpassword/appinfo
    appName: 'Harika APP',
    apiDomain: 'http://localhost:5001',
    websiteDomain: 'http://localhost:3000',
    apiBasePath: '/auth',
    websiteBasePath: '/auth',
  },
  recipeList: [
    EmailPassword.init({
      emailVerificationFeature: {
        mode: 'REQUIRED',
      },
      onHandleEvent: (context) => {
        if (context.action === 'SUCCESS') {
          const authInfo: AuthInfo = {
            userId: context.user.id,
            isOffline: false,
          };
          writeStorage(authStorageKey, authInfo);
        }
      },
    }),
    Session.init(),
  ],
});

console.log('initialized!');
