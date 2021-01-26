import { useMutation, UseMutationOptions } from 'react-query';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };

function fetcher<TData, TVariables>(query: string, variables?: TVariables) {
  return async (): Promise<TData> => {
    const res = await fetch("http://localhost:5000/api/graphql", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
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

export type CreateUserParams = {
  email: Scalars['String'];
  password: Scalars['String'];
};

export type RootMutationType = {
  __typename?: 'RootMutationType';
  createUser: UserPayload;
  login: Session;
};


export type RootMutationTypeCreateUserArgs = {
  params: CreateUserParams;
};


export type RootMutationTypeLoginArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
};

export type RootQueryType = {
  __typename?: 'RootQueryType';
  currentUser?: Maybe<User>;
};

export type Session = {
  __typename?: 'Session';
  token?: Maybe<Scalars['String']>;
  user?: Maybe<User>;
};

export type User = {
  __typename?: 'User';
  email?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['ID']>;
};

export type UserPayload = {
  __typename?: 'UserPayload';
  /** A list of failed validations. May be blank or null if mutation succeeded. */
  messages: Array<ValidationMessage>;
  /** The object created/updated/deleted by the mutation. May be null if mutation failed. */
  result?: Maybe<User>;
  /** Indicates if the mutation completed successfully or not. */
  successful: Scalars['Boolean'];
};

/**
 * Validation messages are returned when mutation input does not meet the requirements.
 *   While client-side validation is highly recommended to provide the best User Experience,
 *   All inputs will always be validated server-side.
 *   Some examples of validations are:
 *   * Username must be at least 10 characters
 *   * Email field does not contain an email address
 *   * Birth Date is required
 *   While GraphQL has support for required values, mutation data fields are always
 *   set to optional in our API. This allows 'required field' messages
 *   to be returned in the same manner as other validations. The only exceptions
 *   are id fields, which may be required to perform updates or deletes.
 */
export type ValidationMessage = {
  __typename?: 'ValidationMessage';
  /** A unique error code for the type of validation used. */
  code: Scalars['String'];
  /**
   * The input field that the error applies to. The field can be used to
   * identify which field the error message should be displayed next to in the
   * presentation layer.
   * If there are multiple errors to display for a field, multiple validation
   * messages will be in the result.
   * This field may be null in cases where an error cannot be applied to a specific field.
   */
  field: Scalars['String'];
  /**
   * A friendly error message, appropriate for display to the end user.
   * The message is interpolated to include the appropriate variables.
   * Example: `Username must be at least 10 characters`
   * This message may change without notice, so we do not recommend you match against the text.
   * Instead, use the *code* field for matching.
   */
  message?: Maybe<Scalars['String']>;
  /** A list of substitutions to be applied to a validation message template */
  options?: Maybe<Array<Maybe<ValidationOption>>>;
  /**
   * A template used to generate the error message, with placeholders for option substiution.
   * Example: `Username must be at least {count} characters`
   * This message may change without notice, so we do not recommend you match against the text.
   * Instead, use the *code* field for matching.
   */
  template?: Maybe<Scalars['String']>;
};

export type ValidationOption = {
  __typename?: 'ValidationOption';
  /** The name of a variable to be subsituted in a validation message template */
  key: Scalars['String'];
  /** The value of a variable to be substituted in a validation message template */
  value: Scalars['String'];
};

export type SignupMutationVariables = Exact<{
  email: Scalars['String'];
  password: Scalars['String'];
}>;


export type SignupMutation = (
  { __typename?: 'RootMutationType' }
  & { createUser: (
    { __typename?: 'UserPayload' }
    & { messages: Array<(
      { __typename?: 'ValidationMessage' }
      & Pick<ValidationMessage, 'field' | 'message' | 'template'>
    )>, result?: Maybe<(
      { __typename?: 'User' }
      & Pick<User, 'email'>
    )> }
  ) }
);


export const SignupDocument = `
    mutation signup($email: String!, $password: String!) {
  createUser(params: {email: $email, password: $password}) {
    messages {
      field
      message
      template
    }
    result {
      email
    }
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