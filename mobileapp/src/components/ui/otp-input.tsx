import { InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native";

interface OtpInputProps {
  value: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  isInvalid?: boolean;
}

export function OtpInput({ value, onChange, onComplete, isInvalid }: OtpInputProps) {
  return (
    <InputOTP
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      isInvalid={isInvalid}
      className="w-full"
    >
      <InputOTP.Group>
        {Array.from({ length: 6 }, (_, i) => (
          <InputOTP.Slot key={i} index={i} />
        ))}
      </InputOTP.Group>
    </InputOTP>
  );
}
