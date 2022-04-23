import 'twin.macro';

import {
  SelfServiceRegistrationFlow,
  UiNodeInputAttributes,
} from '@ory/client';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAuthState } from '../../hooks/useAuthState';
import { oryClient } from '../../oryClient';
import { paths } from '../../paths';
import { cn, useNavigateRef } from '../../utils';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

export const SignupPage = () => {
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigateRef();
  const [, setAuthInfo] = useAuthState();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    setFocus,
  } = useForm<IFormData>();

  const [flow, setFlow] = useState<SelfServiceRegistrationFlow>();

  useEffect(() => {
    const cb = async () => {
      setFlow(
        (await oryClient.initializeSelfServiceRegistrationFlowForBrowsers())
          .data,
      );
    };

    cb();
  }, []);

  console.log({ flow });

  const onSubmit = async (data: IFormData) => {
    try {
      if (!flow) return;

      setIsLoading(true);

      const csrfNode = flow.ui.nodes.find(
        (n) =>
          n.attributes.node_type === 'input' &&
          'name' in n.attributes &&
          n.attributes.name === 'csrf_token',
      );

      if (!csrfNode) {
        throw new Error('No csrf token!');
      }

      const res = await oryClient.submitSelfServiceRegistrationFlow(flow?.id, {
        method: 'password',
        password: data.password,
        csrf_token: (csrfNode?.attributes as UiNodeInputAttributes)?.value,
        traits: { email: data.email },
      });

      setAuthInfo({ userId: res.data.identity.id, isOffline: false });

      navigate.current(paths.vaultIndexPath());
    } catch (e: unknown) {
      console.error(e);

      setError('email', {
        type: 'manual',
        message: 'Email or password is incorrect',
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  return (
    <div tw="max-w-screen-sm mx-auto">
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
          {errors.password && errors.password.message && (
            <span className={formClass('error')}>
              {errors.password.message}
            </span>
          )}
        </div>

        <input
          type="submit"
          className={formClass('submit-btn', { loading: isLoading })}
          disabled={isLoading}
          value="Sign Up"
        />
      </form>
    </div>
  );
};

export default SignupPage;
