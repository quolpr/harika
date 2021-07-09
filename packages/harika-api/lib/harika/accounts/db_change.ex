defmodule Harika.Accounts.DbChange do
  use Ecto.Schema
  use Harika.Sync.DbChange

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "vault_account_db_changes" do
    change_fields()
  end

  change_methods()
end
