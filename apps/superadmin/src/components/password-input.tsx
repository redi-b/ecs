"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <InputGroup className="rounded-full transition-[color,background-color,border-color,box-shadow] duration-200 ease-[var(--ease-operations)]">
        <InputGroupInput {...props} ref={ref} type={visible ? "text" : "password"} />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((current) => !current)}
            size="icon-xs"
            type="button"
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
);
