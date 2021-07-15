import React from 'react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { useSignupMutation } from '../../generated/graphql';
import { useAuthState } from '../../hooks/useAuthState';
import { paths } from '../../paths';
import { cn, setServerErrors } from '../../utils';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

export const SignupPage = () => {
  const history = useHistory();
  const signup = useSignupMutation();
  const [, setAuthInfo] = useAuthState();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<IFormData>();

  const onSubmit = async (data: IFormData) => {
    const res = await signup.mutateAsync({ ...data });

    if (res.createUser.result?.user) {
      const {
        user: { id: userId },
        token,
      } = res.createUser.result;

      setAuthInfo({ userId, isOffline: false, authToken: token });

      history.push(paths.vaultIndexPath());
    } else {
      setServerErrors(res.createUser.messages, setError);
    }
  };

  const { ref: refEmail, ...restEmail } = register('email', { required: true });

  return (
    <div className="max-w-screen-sm mx-auto">
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

export default SignupPage;
