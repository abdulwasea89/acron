import React, { forwardRef } from "react";
import type { TextInput as RNTextInput } from "react-native";
import {
  Description,
  FieldError,
  Input as HInput,
  Label,
  TextField,
} from "heroui-native";

type HInputProps = React.ComponentProps<typeof HInput>;

interface InputProps extends HInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

/*
  Filled, low-contrast inputs matching the web portal: a soft gray fill
  (#f6f7f9 light / #141414 dark) with a hairline border — driven by the
  `--field-*` tokens in global.css, so no per-theme classes are needed here.

  `error` doubles as the invalid flag: passing a message turns the field red
  and renders it, which is how every calling screen already uses this.
*/
export const Input = forwardRef<RNTextInput, InputProps>(
  ({ label, error, hint, ...props }, ref) => {
    const isInvalid = Boolean(error);

    return (
      <TextField isInvalid={isInvalid}>
        {label && <Label>{label}</Label>}
        <HInput ref={ref} {...props} />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : hint ? (
          <Description>{hint}</Description>
        ) : null}
      </TextField>
    );
  },
);

Input.displayName = "Input";
