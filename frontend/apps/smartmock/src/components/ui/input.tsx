import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  // Base styles for all inputs with enhanced focus states
  "flex w-full bg-transparent text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 font-system transition-all duration-300 ease-out input-focus-glow",
  {
    variants: {
      variant: {
        default:
          "border-0 border-b-2 border-border focus:border-warm-brown px-0 py-3 rounded-none focus-visible:outline-none focus-visible:ring-0 hover:border-warm-brown/50",
        outlined:
          "border border-border rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-brown/20 focus-visible:ring-offset-2 focus:border-warm-brown hover:border-warm-brown/50 hover:shadow-sm",
        filled:
          "bg-muted border-0 rounded-lg px-4 py-3 focus-visible:outline-none focus:bg-background focus:ring-2 focus:ring-warm-brown/20 focus:ring-offset-2 hover:bg-muted/80 transition-colors",
        ghost:
          "border-0 px-3 py-3 hover:bg-muted/50 focus:bg-muted/50 focus-visible:outline-none rounded-lg hover:bg-warm-brown/5 focus:bg-warm-brown/5",
      },
      size: {
        default: "h-10 text-sm",
        sm: "h-8 text-xs",
        lg: "h-12 text-base",
      },
      interactive: {
        true: "transform hover:scale-[1.02] focus:scale-[1.02] transition-transform duration-200",
        false: "",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      interactive: false,
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  VariantProps<typeof inputVariants> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }