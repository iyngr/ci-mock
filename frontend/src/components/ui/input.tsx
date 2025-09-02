import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <div className={cn("md-text-field", className)}>
        <input
          type={type}
          className="flex h-10 w-full bg-transparent border-none outline-none px-4 py-2 text-sm placeholder:text-[rgb(var(--md-sys-color-on-surface-variant))] disabled:cursor-not-allowed disabled:opacity-50"
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }