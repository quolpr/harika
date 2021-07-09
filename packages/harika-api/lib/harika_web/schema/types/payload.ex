# It is taken from https://github.com/mirego/absinthe_error_payload/blob/691194ea3360e6e38c8278d5c51f9f9546cd0e5b/lib/absinthe_error_payload/payload.ex
# But some fields are marked as 'non_null'
defmodule HarikaWeb.Schema.Payload do
  defmacro payload_object(payload_name, result_object_name) do
    quote location: :keep do
      object unquote(payload_name) do
        field(:successful, non_null(:boolean),
          description: "Indicates if the mutation completed successfully or not. "
        )

        field(:messages, non_null(list_of(non_null(:validation_message))),
          description: "A list of failed validations. May be blank or null if mutation succeeded."
        )

        field(:result, unquote(result_object_name),
          description:
            "The object created/updated/deleted by the mutation. May be null if mutation failed."
        )
      end
    end
  end
end
