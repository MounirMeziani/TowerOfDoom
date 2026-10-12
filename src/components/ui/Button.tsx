import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}

type AsButton = CommonProps & Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps> & { href?: undefined };
type AsLink = CommonProps & Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps | "href"> & { href: string };

export type ButtonProps = AsButton | AsLink;

const base =
  "inline-flex min-h-11 select-none items-center justify-center text-center gap-2 rounded-md border-2 font-pixel uppercase " +
  "transition-[transform,background-color,border-color,box-shadow,color] duration-150 active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-ember-2 bg-ember text-bg shadow-[0_4px_0_0_#a33a10,0_0_24px_-6px_var(--ember)] hover:bg-ember-2 active:shadow-[0_2px_0_0_#a33a10]",
  secondary: "border-line bg-surface-2 text-text shadow-[0_4px_0_0_#0b0614] hover:border-muted active:shadow-[0_2px_0_0_#0b0614]",
  ghost: "border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-text",
  danger: "border-bad bg-bad/15 text-bad shadow-[0_4px_0_0_#0b0614] hover:bg-bad hover:text-bg",
};

const sizes: Record<ButtonSize, string> = {
  md: "px-4 py-2 text-[0.625rem] sm:text-xs",
  lg: "px-6 py-3 text-xs sm:text-sm",
};

export function buttonClasses({ variant = "primary", size = "md", className = "" }: Pick<CommonProps, "variant" | "size" | "className"> = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

/** Arcade-style button. Renders a next/link when `href` is given. */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, className, children, href, ...rest } = props;
    return (
      <Link href={href} className={buttonClasses({ variant, size, className })} {...rest}>
        {children}
      </Link>
    );
  }
  const { variant, size, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}
