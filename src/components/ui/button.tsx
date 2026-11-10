import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[scale,background-color,color,opacity] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper",
  {
    variants: {
      variant: {
        primary: "bg-paper text-ink-btn hover:bg-ink hover:text-paper",
        line: "border border-line bg-panel text-ink hover:bg-panel-2",
        ghost: "bg-transparent text-ink hover:bg-panel-2",
      },
      size: {
        md: "h-11 px-4 text-sm",
        sm: "h-10 px-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ asChild, className, variant, size, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}
