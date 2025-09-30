import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const textareaVariants = cva(
  // Base styles for all textareas
  "flex min-h-[120px] w-full bg-transparent text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 font-system transition-all duration-200 ease-in-out resize-vertical",
  {
    variants: {
      variant: {
        default:
          "border border-border rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus:border-primary",
        minimal:
          "border-0 border-b-2 border-border focus:border-primary px-0 py-3 rounded-none focus-visible:outline-none focus-visible:ring-0 resize-none",
        filled:
          "bg-muted border-0 rounded-lg px-4 py-3 focus-visible:outline-none focus:bg-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
        ghost:
          "border-0 px-3 py-3 hover:bg-muted/50 focus:bg-muted/50 focus-visible:outline-none rounded-lg",
      },
      size: {
        default: "text-sm",
        sm: "text-xs min-h-[80px]",
        lg: "text-base min-h-[160px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  VariantProps<typeof textareaVariants> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea, textareaVariants }