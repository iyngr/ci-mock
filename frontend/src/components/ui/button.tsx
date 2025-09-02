import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "md-button-filled md-ripple",
        destructive: "md-button-filled bg-[rgb(var(--md-sys-color-error))] text-[rgb(var(--md-sys-color-on-error))] hover:bg-[color-mix(in_srgb,rgb(var(--md-sys-color-error))_92%,white)]",
        outline: "md-button-outlined md-ripple",
        secondary: "md-button-filled bg-[rgb(var(--md-sys-color-secondary))] text-[rgb(var(--md-sys-color-on-secondary))] hover:bg-[color-mix(in_srgb,rgb(var(--md-sys-color-secondary))_92%,white)]",
        ghost: "md-button-text md-ripple",
        link: "text-[rgb(var(--md-sys-color-primary))] underline-offset-4 hover:underline p-0 h-auto bg-transparent border-none",
      },
      size: {
        default: "h-10 px-6 py-2 min-w-[64px]",
        sm: "h-8 px-4 text-xs min-w-[48px]",
        lg: "h-12 px-8 text-base min-w-[80px]",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }