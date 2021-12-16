import React, { useState } from 'react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useHistory } from 'react-router-dom';
import { useAuthState } from '../../hooks/useAuthState';
import { paths } from '../../paths';
import { cn } from '../../utils';
import { useOfflineAccounts } from '../../hooks/useOfflineAccounts';
import { generateId } from '@harika/web-core';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

const auth = getAuth();

export const LoginPage = () => {
  const history = useHistory();
  const [, setAuthInfo] = useAuthState();
  const [offlineAccounts, addOfflineAccount] = useOfflineAccounts();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    setFocus,
  } = useForm<IFormData>();

  React.useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  const onSubmit = useCallback(
    async (data: IFormData) => {
      try {
        setIsLoading(true);

        const res = await signInWithEmailAndPassword(
          auth,
          data.email,
          data.password,
        );

        const token = await res.user.getIdToken(true);

        setAuthInfo({
          userId: res.user.uid,
          isOffline: false,
          authToken: token,
        });

        history.push(paths.vaultIndexPath());
      } catch {
        setError('email', {
          type: 'server',
          message: 'Email or password is wrong',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [history, setAuthInfo, setError],
  );

  const handleWorkOffline = useCallback(() => {
    // const token = 'not-set';

    const { userId } = (() => {
      if (offlineAccounts.accounts.length > 0) {
        return {
          userId: offlineAccounts.accounts[0].id,
          dbId: offlineAccounts.accounts[0].dbId,
        };
      } else {
        const newUserId = generateId();
        const dbId = generateId();

        addOfflineAccount(newUserId, dbId);

        return { userId: newUserId, dbId };
      }
    })();

    setAuthInfo({ userId, authToken: '123', isOffline: true });

    history.push(paths.vaultIndexPath());
  }, [setAuthInfo, history, offlineAccounts.accounts, addOfflineAccount]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setIsLoading(true);

      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);

      const token = await res.user.getIdToken(true);

      setAuthInfo({
        userId: res.user.uid,
        isOffline: false,
        authToken: token,
      });
    } catch (e) {
      alert('Failed to log in with Google. Please, try again.');

      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [setAuthInfo]);

  return (
    <div className="max-w-screen-sm mx-auto px-5">
      <form onSubmit={handleSubmit(onSubmit)} className={`${formClass()}`}>
        <div className={formClass('field')}>
          <label htmlFor="email" className={formClass('label')}>
            Email
          </label>
          <input
            {...register('email', { required: true })}
            type="email"
            placeholder="Email"
            name="email"
            className={formClass('input')}
          />
          {errors.email && errors.email.type === 'required' && (
            <span className={formClass('error')}>Email is required</span>
          )}
          {errors.email && errors.email.message && (
            <span className={formClass('error')}>{errors.email.message}</span>
          )}
        </div>

        <div className={formClass('field')}>
          <label htmlFor="password" className={formClass('label')}>
            Password
          </label>
          <input
            type="password"
            placeholder="Password"
            {...register('password', { required: true })}
            className={formClass('input')}
          />
          {errors.password && errors.password.type === 'required' && (
            <span className={formClass('error')}>Password is required</span>
          )}
        </div>

        <input
          type="submit"
          className={formClass('submit-btn', { loading: isLoading })}
          disabled={isLoading}
          value="Log In"
        />

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className={formClass('sign-up-btn', {
            first: true,
            withGoogle: true,
          })}
        >
          Log In with Google
        </button>

        <Link
          to={paths.signupPath()}
          className={formClass('sign-up-btn', {
            withEmail: true,
          })}
        >
          Sign Up with Email
        </Link>

        <div className="mx-auto mt-3 text-gray-600 text-sm">
          Or{' '}
          <button
            className="underline cursor-pointer"
            onClick={handleWorkOffline}
          >
            work offline
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
