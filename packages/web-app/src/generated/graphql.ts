import { useMutation, UseMutationOptions } from 'react-query';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };

function fetcher<TData, TVariables>(query: string, variables?: TVariables) {
  return async (): Promise<TData> => {
    const res = await fetch(`${import.meta.env.SNOWPACK_PUBLIC_API_URL}/api/graphql` as string, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      credentials: "include",
      body: JSON.stringify({ query, variables }),
    });
    
    const json = await res.json();

    if (json.errors) {
      const { message } = json.errors[0];

      throw new Error(message);
    }

    return json.data;
  }
}
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type CreateUserInput = {
  email: Scalars['String'];
  password: Scalars['String'];
};

export type LoginInput = {
  email: Scalars['String'];
  password: Scalars['String'];
};

export type LoginResultType = {
  __typename?: 'LoginResultType';
  authed: Scalars['Boolean'];
  user?: Maybe<UserType>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createUser: UserType;
  login: LoginResultType;
};


export type MutationCreateUserArgs = {
  payload: CreateUserInput;
};


export type MutationLoginArgs = {
  payload: LoginInput;
};

export type Query = {
  __typename?: 'Query';
  viewer: UserType;
};

export type UserType = {
  __typename?: 'UserType';
  id: Scalars['ID'];
  email: Scalars['String'];
};

export type LoginMutationVariables = Exact<{
  email: Scalars['String'];
  password: Scalars['String'];
}>;


export type LoginMutation = (
  { __typename?: 'Mutation' }
  & { login: (
    { __typename?: 'LoginResultType' }
    & Pick<LoginResultType, 'authed'>
    & { user?: Maybe<(
      { __typename?: 'UserType' }
      & Pick<UserType, 'id'>
    )> }
  ) }
);

export type SignupMutationVariables = Exact<{
  email: Scalars['String'];
  password: Scalars['String'];
}>;


export type SignupMutation = (
  { __typename?: 'Mutation' }
  & { createUser: (
    { __typename?: 'UserType' }
    & Pick<UserType, 'id'>
  ) }
);


export const LoginDocument = `
    mutation login($email: String!, $password: String!) {
  login(payload: {email: $email, password: $password}) {
    authed
    user {
      id
    }
  }
}
    `;
export const useLoginMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<LoginMutation, TError, LoginMutationVariables, TContext>) => 
    useMutation<LoginMutation, TError, LoginMutationVariables, TContext>(
      (variables?: LoginMutationVariables) => fetcher<LoginMutation, LoginMutationVariables>(LoginDocument, variables)(),
      options
    );
export const SignupDocument = `
    mutation signup($email: String!, $password: String!) {
  createUser(payload: {email: $email, password: $password}) {
    id
  }
}
    `;
export const useSignupMutation = <
      TError = unknown,
      TContext = unknown
    >(options?: UseMutationOptions<SignupMutation, TError, SignupMutationVariables, TContext>) => 
    useMutation<SignupMutation, TError, SignupMutationVariables, TContext>(
      (variables?: SignupMutationVariables) => fetcher<SignupMutation, SignupMutationVariables>(SignupDocument, variables)(),
      options
    );