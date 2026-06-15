import { useState } from "react";
import { IconButton, InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

type Props = Omit<TextFieldProps, "type">;

/**
 * MUI text field for passwords with a built-in show/hide eye toggle.
 * Drop-in replacement for `<TextField type="password" ... />`.
 */
export function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      InputProps={{
        ...(props.InputProps ?? {}),
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={() => setVisible((v) => !v)}
              edge="end"
              aria-label={visible ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        )
      }}
    />
  );
}
