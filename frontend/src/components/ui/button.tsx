import * as React from "react"
import "@material/web/button/filled-button.js"
import "@material/web/button/outlined-button.js"
import "@material/web/button/text-button.js"

import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", children, disabled, ...props }, ref) => {
    const getSizeClasses = () => {
      switch (size) {
        case "sm":
          return "text-sm h-8 px-3"
        case "lg":
          return "text-base h-12 px-6"
        case "icon":
          return "h-10 w-10 p-0"
        default:
          return "text-sm h-10 px-4"
      }
    }

    // Get variant-specific styling
    const getVariantClasses = () => {
      switch (variant) {
        case "destructive":
          return "bg-destructive text-destructive-foreground hover:bg-destructive/90"
        case "outline":
          return "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
        case "secondary":
          return "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        case "ghost":
          return "hover:bg-accent hover:text-accent-foreground"
        case "link":
          return "text-primary underline-offset-4 hover:underline"
        default:
          return "bg-primary text-primary-foreground hover:bg-primary/90"
      }
    }

    // For Material Design buttons, we'll use a hybrid approach
    // Using Material Web Components styling with our custom behavior
    return (
      <button
        className={cn(
          // Base Material 3 button styles
          "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          // Material 3 elevation and shadow
          "shadow-sm hover:shadow-md active:shadow-none",
          // Size classes
          getSizeClasses(),
          // Variant classes
          getVariantClasses(),
          className
        )}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"

export { Button }