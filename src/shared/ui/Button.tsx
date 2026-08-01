import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export default function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  const classes = [styles.button, variant === "secondary" ? styles.secondary : "", className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...rest} />;
}
