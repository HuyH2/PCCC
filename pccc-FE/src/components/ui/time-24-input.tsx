import * as React from "react";
import { Input } from "@/components/ui/input";

type Time24InputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "pattern" | "maxLength"
>;

function Time24Input(props: Time24InputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
      maxLength={5}
      placeholder="HH:mm"
      title="Nhập giờ theo định dạng 24 giờ HH:mm, ví dụ 19:00"
    />
  );
}

export { Time24Input };
