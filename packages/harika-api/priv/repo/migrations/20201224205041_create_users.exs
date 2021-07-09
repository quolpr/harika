defmodule Harika.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :email, :string, null: false
      add :password_hash, :string, null: false
      add :db_id, :string, null: false
      add :db_pass, :string, null: false

      timestamps()
    end

    create unique_index(:users, [:email])
    create unique_index(:users, [:db_id])
  end
end
