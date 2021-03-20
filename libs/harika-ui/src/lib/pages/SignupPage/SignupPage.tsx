import React from 'react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { useSignupMutation } from '../../generated/graphql';
import { useAuthState } from '../../hooks/useAuthState';
import { paths } from '../../paths';
import { cn } from '../../utils';
import { setServerErrors } from '../../utils/setServerErrors';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

export const SignupPage = () => {
  const history = useHistory();
  const signup = useSignupMutation();
  const [, setAuthInfo] = useAuthState();

  const { register, handleSubmit, errors, setError } = useForm<IFormData>();

  const onSubmit = async (data: IFormData) => {
    const res = await signup.mutateAsync(data);

    if (res.createUser.result) {
      const {
        token,
        user: { id: userId },
      } = res.createUser.result;

      setAuthInfo({ token, userId, isOffline: false });

      history.push(paths.vaultIndexPath());
    } else {
      setServerErrors(res.createUser.messages, setError);
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
          {errors.password && errors.password.message && (
            <span className={formClass('error')}>
              {errors.password.message}
            </span>
          )}
        </div>

        <input
          type="submit"
          className={formClass('submit-btn', { loading: signup.isLoading })}
          disabled={signup.isLoading}
          value="Sign Up"
        />
      </form>
    </div>
  );
};
