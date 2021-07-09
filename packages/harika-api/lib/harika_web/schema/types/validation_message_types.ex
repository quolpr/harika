# It is taken from https://github.com/mirego/absinthe_error_payload/blob/master/lib/absinthe_error_payload/validation_message_types.ex
# But some fields are marked as 'non_null' 
defmodule HarikaWeb.Schema.ValidationMessageTypes do
  @moduledoc """
  This contains absinthe objects used in mutation responses.
  To use, import into your Absinthe.Schema files with
  ```
  import_types AbsintheErrorPayload.ValidationMessageTypes
  ```
  ## Objects
  `:validation_option` holds a key value pair. These values are substitutions to be applied to a validation message template
  ```elixir
  object :validation_option do
    field :key, non_null(:string), description: "..."
    field :value, non_null(:string), description: "..."
  end
  ```
  :validation_message contains all fields included in a `AbsintheErrorPayload.ValidationMessage` for maximum flexibility.
  This is possibly more information than you wish to supply - in that case, rather than importing this Module,
  you can create your own objects and use them. For example, if you only want to supply interpolated messages,
  the `:template` and `:options` fields are unnecessary.
  ```elixir
  object :validation_message, descriptin: "..." do
    field :field, :string, description: "..."
    field :message, :string, description: "..."
    field :code, non_null(:string), description: "..."
    field :template, :string, description: "..."
    field :options, list_of(:validation_option), description: "..."
  end
  ```
  Actual descriptions have been ommited for brevity - check the github repo to see them.
  """
  use Absinthe.Schema.Notation

  object(:validation_option) do
    @desc "The name of a variable to be subsituted in a validation message template"
    field(:key, non_null(:string), description: @descs.option_key)

    @desc "The value of a variable to be substituted in a validation message template"
    field(:value, non_null(:string), description: @descs.option_value)
  end

  @desc """
    Validation messages are returned when mutation input does not meet the requirements.
    While client-side validation is highly recommended to provide the best User Experience,
    All inputs will always be validated server-side.
    Some examples of validations are:
    * Username must be at least 10 characters
    * Email field does not contain an email address
    * Birth Date is required
    While GraphQL has support for required values, mutation data fields are always
    set to optional in our API. This allows 'required field' messages
    to be returned in the same manner as other validations. The only exceptions
    are id fields, which may be required to perform updates or deletes.
  """
  object :validation_message do
    @desc """
    The input field that the error applies to. The field can be used to
    identify which field the error message should be displayed next to in the
    presentation layer.
    If there are multiple errors to display for a field, multiple validation
    messages will be in the result.
    This field may be null in cases where an error cannot be applied to a specific field.
    """
    field(:field, non_null(:string), description: @descs.field)

    @desc """
    A friendly error message, appropriate for display to the end user.
    The message is interpolated to include the appropriate variables.
    Example: `Username must be at least 10 characters`
    This message may change without notice, so we do not recommend you match against the text.
    Instead, use the *code* field for matching.
    """
    field(:message, non_null(:string), description: @descs.message)

    @desc "A unique error code for the type of validation used."
    field(:code, non_null(:string), description: @descs.code)

    @desc """
    A template used to generate the error message, with placeholders for option substiution.
    Example: `Username must be at least {count} characters`
    This message may change without notice, so we do not recommend you match against the text.
    Instead, use the *code* field for matching.
    """
    field(:template, :string, description: @descs.template)

    @desc "A list of substitutions to be applied to a validation message template"
    field(:options, list_of(:validation_option), description: @descs.option_list)
  end
end
