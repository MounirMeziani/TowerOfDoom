import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PanelProps<T extends ElementType = "div"> = {
  as?: T;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/** Surface card: 2px line border with a subtle inner glow. */
export function Panel<T extends ElementType = "div">({ as, children, className = "", ...rest }: PanelProps<T>) {
  // Narrowed so 3D JSX intrinsics (react-three-fiber) do not widen the tag props to `never`.
  const Tag = (as ?? "div") as ElementType<{ className?: string; children?: ReactNode }>;
  return (
    <Tag
      className={`rounded-lg border-2 border-line bg-surface p-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.03),inset_0_0_32px_-12px_var(--receiving)] sm:p-6 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
