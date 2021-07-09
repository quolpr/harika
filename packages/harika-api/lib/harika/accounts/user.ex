defmodule Harika.Accounts.User do
  use Ecto.Schema
  use Pow.Ecto.Schema

  import Ecto.Changeset

  alias Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "users" do
    pow_user_fields()

    field :db_id, :string
    field :db_pass, :string

    timestamps()
  end

  def changeset(user_or_changeset, attrs) do
    pow_changeset(user_or_changeset, attrs)
    |> cast(attrs, [:db_id])
    |> validate_required([:db_id])
    |> set_db_pass()
    |> unique_constraint(:db_id)
  end

  def set_db_pass(ch = %Ecto.Changeset{}) do
    Changeset.put_change(ch, :db_pass, generate_pass())
  end

  defp generate_pass do
    length = 32

    :crypto.strong_rand_bytes(length) |> Base.encode64() |> binary_part(0, length)
  end
end
