import { generateId } from '@harika/web-core';
import { SelfServiceLoginFlow, UiNodeInputAttributes } from '@ory/client';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { useAuthState } from '../../hooks/useAuthState';
import { useOfflineAccounts } from '../../hooks/useOfflineAccounts';
import { oryClient } from '../../oryClient';
import { paths } from '../../paths';
import { cn, useNavigateRef } from '../../utils';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

export const LoginPage = () => {
  const [flow, setFlow] = useState<SelfServiceLoginFlow>();

  const navigate = useNavigateRef();
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

  useEffect(() => {
    const cb = async () => {
      setFlow(
        (await oryClient.initializeSelfServiceLoginFlowForBrowsers(true)).data,
      );
    };

    cb();
  }, []);

  const onSubmit = useCallback(
    async (data: IFormData) => {
      try {
        if (!flow) return;

        setIsLoading(true);

        const csrfNode = flow.ui.nodes.find(
          (n) =>
            n.attributes.node_type === 'input' &&
            'name' in n.attributes &&
            n.attributes.name === 'csrf_token',
        );

        const response = await oryClient.submitSelfServiceLoginFlow(
          String(flow.id),
          undefined,
          {
            csrf_token: (csrfNode?.attributes as UiNodeInputAttributes)?.value,
            identifier: data.email,
            password: data.password,
            method: 'password',
          },
        );

        setAuthInfo({
          userId: response.data.session.identity.id,
          isOffline: false,
        });

        navigate.current(paths.vaultIndexPath());
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.data) {
          setError('email', {
            type: 'server',
            message: 'Email or password is wrong',
          });
        } else {
          alert('Error happened. Please, try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [flow, navigate, setAuthInfo, setError],
  );

  const handleWorkOffline = useCallback(() => {
    // const token = 'not-set';

    const { userId } = ((): { userId: string; dbId: string } => {
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

    setAuthInfo({ userId, isOffline: true });

    navigate.current(paths.vaultIndexPath());
  }, [setAuthInfo, navigate, offlineAccounts.accounts, addOfflineAccount]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setIsLoading(true);

      setAuthInfo({
        userId: '123',
        isOffline: false,
      });

      navigate.current(paths.vaultIndexPath());
    } catch (e) {
      alert('Failed to log in with Google. Please, try again.');

      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setAuthInfo]);

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
