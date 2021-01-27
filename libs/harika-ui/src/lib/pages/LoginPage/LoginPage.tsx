import React from 'react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { useLoginMutation } from '../../generated/graphql';
import { useAuthState } from '../../hooks/useAuthState';
import { paths } from '../../paths';
import { cn } from '../../utils';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

export const LoginPage = () => {
  const history = useHistory();
  const login = useLoginMutation();
  const [, setAuthInfo] = useAuthState();

  const { register, handleSubmit, errors, setError } = useForm<IFormData>();

  const onSubmit = async (data: IFormData) => {
    try {
      const res = await login.mutateAsync(data);

      const {
        token,
        user: { id: userId },
      } = res.login;

      setAuthInfo({ token, userId });

      history.push(paths.vaultIndexPath());
    } catch {
      setError('email', {
        type: 'server',
        message: 'Email or password is wrong',
      });
    }
  };

  return (
    <div className="max-w-screen-sm mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className={`${formClass()}`}>
        <div className={formClass('field')}>
          <label htmlFor="name" className={formClass('label')}>
            Email
          </label>
          <input
            type="email"
            placeholder="Email"
            name="email"
            ref={(el) => {
              el?.focus();
              register(el, { required: true });
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
            name="password"
            ref={register({ required: true })}
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
      </form>
    </div>
  );
};
