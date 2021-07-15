import React from 'react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { useLoginMutation } from '../../generated/graphql';
import { useAuthState } from '../../hooks/useAuthState';
import { paths } from '../../paths';
import { cn } from '../../utils';
import { useOfflineAccounts } from '../../hooks/useOfflineAccounts';
import { generateId } from '@harika/common';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

export const LoginPage = () => {
  const history = useHistory();
  const login = useLoginMutation();
  const [, setAuthInfo] = useAuthState();
  const [offlineAccounts, addOfflineAccount] = useOfflineAccounts();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<IFormData>();

  const { ref: refEmail, ...restEmail } = register('email', { required: true });

  const onSubmit = useCallback(
    async (data: IFormData) => {
      try {
        const res = await login.mutateAsync(data);

        if (!res.login || !res.login.user) throw new Error('auth error');

        const {
          token,
          user: { id: userId },
        } = res.login;

        setAuthInfo({ userId, isOffline: false, authToken: token });

        history.push(paths.vaultIndexPath());
      } catch {
        setError('email', {
          type: 'server',
          message: 'Email or password is wrong',
        });
      }
    },
    [history, login, setAuthInfo, setError],
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

  return (
    <div className="max-w-screen-sm mx-auto px-5">
      <form onSubmit={handleSubmit(onSubmit)} className={`${formClass()}`}>
        <div className={formClass('field')}>
          <label htmlFor="name" className={formClass('label')}>
            Email
          </label>
          <input
            {...restEmail}
            type="email"
            placeholder="Email"
            name="email"
            ref={(el) => {
              el?.focus();
              refEmail(el);
            }}
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
          <label htmlFor="name" className={formClass('label')}>
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
          className={formClass('submit-btn', { loading: login.isLoading })}
          disabled={login.isLoading}
          value="Log In"
        />

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
