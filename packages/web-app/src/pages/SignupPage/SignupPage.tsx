import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { useAuthState } from '../../hooks/useAuthState';
import { paths } from '../../paths';
import { cn } from '../../utils';

const formClass = cn('form');

type IFormData = {
  email: string;
  password: string;
};

const auth = getAuth();

export const SignupPage = () => {
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const [, setAuthInfo] = useAuthState();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    setFocus,
  } = useForm<IFormData>();

  const onSubmit = async (data: IFormData) => {
    try {
      setIsLoading(true);

      const res = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );

      setAuthInfo({ userId: res.user.uid, isOffline: false });

      navigate(paths.vaultIndexPath());
    } catch (e: unknown) {
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
    <div className="max-w-screen-sm mx-auto">
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
