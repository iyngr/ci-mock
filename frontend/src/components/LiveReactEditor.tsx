"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Editor from "@monaco-editor/react"
import { Button } from "@/components/ui/button"

interface LiveReactEditorProps {
    initialCode: string
    onChange: (code: string) => void
    onRun: (code: string) => void
    showNotification: (message: string) => void
    language?: string
}

export default function LiveReactEditor({
    initialCode,
    onChange,
    onRun,
    showNotification,
    language = 'javascript'
}: LiveReactEditorProps) {
    const [code, setCode] = useState(initialCode)
    const [preview, setPreview] = useState("")
    const [errors, setErrors] = useState<string[]>([])
    const [isCompiling, setIsCompiling] = useState(false)
    const [consoleOutput, setConsoleOutput] = useState<string[]>([])
    const previewRef = useRef<HTMLIFrameElement>(null)

    // Real-time compilation and preview (debounced)
    useEffect(() => {
        const compileAndPreview = async () => {
            setIsCompiling(true)
            try {
                // Validate syntax first
                const syntaxErrors = validateSyntax(code)
                setErrors(syntaxErrors)

                if (syntaxErrors.length === 0) {
                    // Generate live preview
                    const previewHtml = generateLivePreview(code)
                    setPreview(previewHtml)
                    updateIframeContent(previewHtml)
                }
            } catch (error) {
                setErrors([`Compilation Error: ${error}`])
            } finally {
                setIsCompiling(false)
            }
        }

        const debounceTimer = setTimeout(compileAndPreview, 800) // 800ms debounce for live updates
        return () => clearTimeout(debounceTimer)
    }, [code])

    const validateSyntax = (code: string): string[] => {
        const errors: string[] = []

        try {
            // React component validation
            if (language === 'javascript' || language === 'typescript') {
                // Check for React component structure
                if (!code.includes('function') && !code.includes('const') && !code.includes('class')) {
                    errors.push("Please create a React component (function or class)")
                }

                // Check for JSX return
                if (code.includes('function') && !code.includes('return')) {
                    errors.push("React function component should return JSX")
                }

                // Check for unmatched JSX tags
                const openTags = (code.match(/<[^/\s>]+/g) || []).length
                const closeTags = (code.match(/<\/[^>]+>/g) || []).length
                const selfClosing = (code.match(/<[^>]+\/>/g) || []).length

                if (openTags !== closeTags + selfClosing) {
                    errors.push("Unmatched JSX tags detected")
                }

                // Check for missing React hooks import if using hooks
                if ((code.includes('useState') || code.includes('useEffect')) &&
                    !code.includes('import') && !code.includes('React.useState')) {
                    errors.push("Import React hooks or use React.useState/React.useEffect")
                }
            }

            // Basic bracket matching
            const openBrackets = (code.match(/\{/g) || []).length
            const closeBrackets = (code.match(/\}/g) || []).length
            if (openBrackets !== closeBrackets) {
                errors.push("Unmatched curly brackets")
            }

        } catch (error) {
            errors.push(`Syntax validation error: ${error}`)
        }

        return errors
    }

    const generateLivePreview = (code: string): string => {
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>React Preview</title>
        <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f8f9fa;
          }
          .error { 
            color: #dc3545;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 12px;
            border-radius: 6px;
            margin: 10px 0;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
          }
          .app-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-height: 200px;
          }
          /* Common CSS for better styling */
          button {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 4px;
            font-size: 14px;
          }
          button:hover { background: #0056b3; }
          button:disabled { background: #6c757d; cursor: not-allowed; }
          input, textarea {
            border: 1px solid #ddd;
            padding: 8px;
            border-radius: 4px;
            margin: 4px;
            font-size: 14px;
          }
          input:focus, textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
          }
          .todo-item {
            display: flex;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid #eee;
          }
          .completed {
            text-decoration: line-through;
            color: #666;
          }
          .card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            margin: 8px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .form-group {
            margin-bottom: 16px;
          }
          .form-group label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
          }
          .counter {
            text-align: center;
            padding: 20px;
          }
          .counter h1 {
            font-size: 3rem;
            margin: 20px 0;
          }
          .positive { color: #28a745; }
          .negative { color: #dc3545; }
          .zero { color: #000; }
        </style>
      </head>
      <body>
        <div id="app" class="app-container"></div>
        <div id="console-output" style="margin-top: 20px;"></div>
        
        <script type="text/babel">
          // Capture console.log for display
          const originalLog = console.log;
          const originalError = console.error;
          const consoleDiv = document.getElementById('console-output');
          
          window.capturedLogs = [];
          
          console.log = function(...args) {
            window.capturedLogs.push({type: 'log', content: args.join(' ')});
            originalLog.apply(console, args);
            updateConsoleDisplay();
          };
          
          console.error = function(...args) {
            window.capturedLogs.push({type: 'error', content: args.join(' ')});
            originalError.apply(console, args);
            updateConsoleDisplay();
          };
          
          function updateConsoleDisplay() {
            if (window.capturedLogs.length > 0) {
              consoleDiv.innerHTML = '<h4>Console Output:</h4>' + 
                window.capturedLogs.map(log => 
                  \`<div style="font-family: monospace; padding: 4px; background: \${log.type === 'error' ? '#ffe6e6' : '#f0f0f0'}; margin: 2px 0; border-radius: 3px;">\${log.content}</div>\`
                ).join('');
            }
          }

          try {
            // Inject the user's code
            ${code}
            
            // Auto-detect and render React component
            const componentNames = [];
            
            // Extract component names from the code
            const functionMatches = "${code}".match(/function\\s+(\\w+)/g);
            const constMatches = "${code}".match(/const\\s+(\\w+)\\s*=/g);
            
            if (functionMatches) {
              functionMatches.forEach(match => {
                const name = match.replace(/function\\s+/, '');
                if (name && name[0] === name[0].toUpperCase()) {
                  componentNames.push(name);
                }
              });
            }
            
            if (constMatches) {
              constMatches.forEach(match => {
                const name = match.replace(/const\\s+/, '').replace(/\\s*=$/, '');
                if (name && name[0] === name[0].toUpperCase()) {
                  componentNames.push(name);
                }
              });
            }
            
            // Try to render the first detected component
            if (componentNames.length > 0) {
              const ComponentName = componentNames[0];
              if (typeof window[ComponentName] !== 'undefined') {
                const root = ReactDOM.createRoot(document.getElementById('app'));
                root.render(React.createElement(window[ComponentName]));
              } else {
                // Try to evaluate as expression
                try {
                  const Component = eval(ComponentName);
                  const root = ReactDOM.createRoot(document.getElementById('app'));
                  root.render(React.createElement(Component));
                } catch (evalError) {
                  console.error('Component evaluation failed:', evalError.message);
                }
              }
            } else {
              document.getElementById('app').innerHTML = 
                '<div class="error">No React component detected. Make sure your component name starts with a capital letter.</div>';
            }
            
          } catch (error) {
            document.getElementById('app').innerHTML = 
              '<div class="error"><strong>Runtime Error:</strong><br>' + error.message + '</div>';
            console.error('Runtime Error:', error);
          }
        </script>
      </body>
      </html>
    `
    }

    const updateIframeContent = (html: string) => {
        if (previewRef.current) {
            const iframe = previewRef.current
            iframe.srcdoc = html
        }
    }

    const handleCodeChange = (value: string | undefined) => {
        const newCode = value || ""
        setCode(newCode)
        onChange(newCode)
    }

    const forceRefresh = () => {
        const previewHtml = generateLivePreview(code)
        updateIframeContent(previewHtml)
    }

    const runCode = async () => {
        try {
            await onRun(code)
            forceRefresh()
        } catch (error) {
            console.error('Run code error:', error)
        }
    }

    return (
        <div className="space-y-4">
            {/* Code Editor */}
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
                    <span className="font-medium text-gray-700">
                        Code Editor {isCompiling && <span className="text-blue-600">(Compiling...)</span>}
                    </span>
                    <div className="flex space-x-2">
                        <Button onClick={runCode} variant="outline" size="sm">
                            Run Code
                        </Button>
                        <Button onClick={forceRefresh} variant="outline" size="sm">
                            Refresh Preview
                        </Button>
                    </div>
                </div>
                <Editor
                    height="350px"
                    defaultLanguage={language}
                    value={code}
                    onChange={handleCodeChange}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        scrollBeyondLastLine: false,
                        contextmenu: false,
                        automaticLayout: true,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true,
                        tabSize: 2,
                    }}
                    onMount={(editor) => {
                        // Disable copy/paste but maintain all other functionality
                        editor.addCommand(2048, () => showNotification("📋 Copying is disabled"))
                        editor.addCommand(2080, () => showNotification("📋 Pasting is disabled"))
                        editor.addCommand(2072, () => showNotification("📋 Cutting is disabled"))
                    }}
                />
            </div>

            {/* Error Display */}
            {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-red-800 font-semibold mb-2">⚠️ Syntax Errors:</h4>
                    <ul className="text-red-700 space-y-1">
                        {errors.map((error, index) => (
                            <li key={index} className="text-sm">• {error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Live Preview */}
            <div className="border rounded-lg bg-white shadow-sm">
                <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                    <h4 className="font-semibold text-gray-700">
                        Live Preview {isCompiling && <span className="text-blue-600 text-sm">(Updating...)</span>}
                    </h4>
                    <div className="text-sm text-gray-500">
                        Changes reflect automatically
                    </div>
                </div>
                <iframe
                    ref={previewRef}
                    className="w-full h-96 border-0"
                    title="Live Code Preview"
                    sandbox="allow-scripts"
                    srcDoc={preview}
                />
            </div>
        </div>
    )
}
