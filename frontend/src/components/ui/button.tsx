import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base styles for all buttons with enhanced interactivity
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-system relative overflow-hidden group",
  {
    variants: {
      variant: {
        default:
          "gradient-primary text-white shadow-sm hover:shadow-lg hover:-translate-y-1 hover:shadow-blue-500/25 active:translate-y-0 active:shadow-sm ripple btn-hover-lift",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-lg hover:-translate-y-1 active:translate-y-0 btn-hover-lift",
        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-warm-brown/20 active:translate-y-0 btn-hover-lift",
        secondary:
          "gradient-secondary text-white shadow-sm hover:shadow-lg hover:-translate-y-1 hover:shadow-purple-500/25 active:translate-y-0 ripple btn-hover-lift",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 hover:bg-warm-brown/5 transition-all duration-200",
        link:
          "text-primary underline-offset-4 hover:underline nav-link-slide",
        gradient:
          "gradient-accent text-white shadow-sm hover:shadow-lg hover:-translate-y-1 hover:shadow-pink-500/25 active:translate-y-0 ripple btn-hover-lift",
        minimal:
          "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 btn-hover-lift",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
      },
      glow: {
        true: "hover:shadow-2xl hover:shadow-warm-brown/20",
        false: "",
      },
      interactive: {
        true: "transform transition-all duration-300 hover:scale-105 active:scale-95",
        false: "",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: false,
      interactive: false,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, glow, interactive, asChild = false, loading, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, glow, interactive, className }))}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            {children && <span className="ml-1">{children}</span>}
          </div>
        ) : (
          children
        )}

        {/* Ripple effect overlay */}
        <span className="absolute inset-0 pointer-events-none">
          <span className="absolute inset-0 rounded-lg bg-white/20 scale-0 group-active:scale-100 transition-transform duration-200 ease-out"></span>
        </span>
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }