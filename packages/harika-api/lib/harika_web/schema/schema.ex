defmodule HarikaWeb.Schema do
  use Absinthe.Schema

  import AbsintheErrorPayload.Payload, except: [payload_object: 2]
  import HarikaWeb.Schema.Payload

  alias HarikaWeb.Schema.AuthenticationMiddleware
  alias HarikaWeb.Schema.AccountsResolver

  import_types(HarikaWeb.Schema.ValidationMessageTypes)

  object :session do
    field :token, non_null(:string)
    field :user, non_null(:user)
  end

  object :user do
    field :id, non_null(:id)
    field :email, non_null(:string)
  end

  payload_object(:session_payload, :session)

  input_object :create_user_params do
    field :email, non_null(:string)
    field :password, non_null(:string)
  end

  query do
    field :current_user, :user do
      middleware(AuthenticationMiddleware)

      resolve(fn _parent, %{context: %{current_user: current_user}} ->
        {:ok, current_user}
      end)
    end
  end

  mutation do
    field :create_user, non_null(:session_payload) do
      arg(:params, non_null(:create_user_params))

      resolve(&AccountsResolver.create_user/3)
      middleware(&build_payload/2)
    end

    field :login, non_null(:session) do
      arg(:email, non_null(:string))
      arg(:password, non_null(:string))

      resolve(&AccountsResolver.login/3)
    end
  end
end
