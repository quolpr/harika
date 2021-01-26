import React from 'react';
import { useForm } from 'react-hook-form';
import { useSignupMutation } from '../../generated/graphql';
import { cn } from '../../utils';

const signupFormClass = cn('signup-form');

type IFormData = {
  email: string;
  password: string;
};

export const SignupPage = () => {
  const signup = useSignupMutation();

  const { register, handleSubmit, errors } = useForm<IFormData>();

  const onSubmit = async (data: IFormData) => {
    // TODO: check result if field will have multiple errors
    const res = await signup.mutateAsync(data);

    console.log(res);

    console.log('hey!', data);
  };

  return (
    <div className="max-w-screen-sm mx-auto">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={`${signupFormClass()}`}
      >
        <div>
          <label htmlFor="name" className={signupFormClass('label')}>
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
            className={signupFormClass('input')}
          />
          {errors.email && errors.email.type === 'required' && (
            <span className={signupFormClass('error')}>Email is required</span>
          )}
        </div>

        <div>
          <label htmlFor="name" className={signupFormClass('label')}>
            Password
          </label>
          <input
            type="password"
            placeholder="Password"
            name="password"
            ref={register({ required: true })}
            className={signupFormClass('input')}
          />
          {errors.password && errors.password.type === 'required' && (
            <span className={signupFormClass('error')}>
              Password is required
            </span>
          )}
        </div>

        <input type="submit" className={signupFormClass('submit-btn')} />
      </form>
    </div>
  );
};
