"""
AutoGen Studio Configuration Script

This script provides a simple way to start AutoGen Studio for development
and testing of the multi-agent assessment workflows.

AutoGen Studio provides a web-based UI for:
- Designing and testing agent workflows
- Configuring agent teams and models
- Debugging agent conversations
- Rapid prototyping of new agent capabilities

Usage:
    python autogen_studio_config.py

Note: This requires autogen-studio to be installed as a dev dependency.
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def create_autogen_studio_config():
    """
    Create AutoGen Studio configuration files for the assessment platform.
    """
    
    # Create AutoGen Studio config directory
    config_dir = Path("autogen_studio_config")
    config_dir.mkdir(exist_ok=True)
    
    # Model configuration for AutoGen Studio
    model_config = {
        "models": [
            {
                "provider": "autogen_ext.models.openai.AzureOpenAIChatCompletionClient",
                "component_type": "model",
                "version": 1,
                "component_version": 1,
                "description": "Azure OpenAI GPT-4o for assessment tasks",
                "label": "AzureOpenAI-GPT4o",
                "config": {
                    "model": "gpt-4o",
                    "azure_deployment": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o"),
                    "azure_endpoint": os.getenv("AZURE_OPENAI_ENDPOINT", "https://your-endpoint.openai.azure.com/"),
                    "api_version": os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview"),
                    "api_key": "REPLACE_WITH_YOUR_API_KEY"
                }
            }
        ]
    }
    
    # Agent team configuration
    team_config = {
        "name": "Assessment Team",
        "description": "Multi-agent team for comprehensive technical assessment evaluation",
        "agents": [
            {
                "name": "Orchestrator_Agent",
                "type": "AssistantAgent",
                "description": "Project manager that coordinates the assessment workflow",
                "system_message": "You are the project manager for an AI assessment platform..."
            },
            {
                "name": "Code_Analyst_Agent", 
                "type": "AssistantAgent",
                "description": "Senior software engineer specialized in code evaluation",
                "system_message": "You are a senior software engineer with expertise in code evaluation..."
            },
            {
                "name": "Text_Analyst_Agent",
                "type": "AssistantAgent", 
                "description": "Expert in technical communication and descriptive answer evaluation",
                "system_message": "You are an expert in technical communication and knowledge assessment..."
            },
            {
                "name": "Report_Synthesizer_Agent",
                "type": "AssistantAgent",
                "description": "Report writer that synthesizes all scoring data",
                "system_message": "You are a professional report writer specialized in technical assessment reports..."
            }
        ],
        "workflow": "SelectorGroupChat",
        "termination_conditions": {
            "text_mention": "TERMINATE",
            "max_messages": 25
        }
    }
    
    # Save configurations
    with open(config_dir / "models.json", "w") as f:
        json.dump(model_config, f, indent=2)
    
    with open(config_dir / "assessment_team.json", "w") as f:
        json.dump(team_config, f, indent=2)
    
    print("✓ AutoGen Studio configuration files created in autogen_studio_config/")
    print("  - models.json: Model configurations")
    print("  - assessment_team.json: Agent team setup")

def check_autogen_studio_installation():
    """
    Check if AutoGen Studio is installed and available.
    """
    try:
        import autogen_studio
        print("✓ AutoGen Studio is installed")
        return True
    except ImportError:
        print("❌ AutoGen Studio is not installed")
        print("   Install it with: uv add --dev autogen-studio")
        return False

def start_autogen_studio():
    """
    Start AutoGen Studio development server.
    """
    if not check_autogen_studio_installation():
        return False
    
    print("\n🚀 Starting AutoGen Studio...")
    print("   This will open a web interface for designing and testing agent workflows")
    print("   Default URL: http://localhost:8081")
    print("   Press Ctrl+C to stop the server")
    
    try:
        # Start AutoGen Studio
        subprocess.run([
            sys.executable, "-m", "autogen_studio", 
            "--port", "8081",
            "--host", "0.0.0.0"
        ])
    except KeyboardInterrupt:
        print("\n✓ AutoGen Studio stopped")
    except Exception as e:
        print(f"❌ Error starting AutoGen Studio: {e}")
        return False
    
    return True

def print_studio_usage_guide():
    """
    Print usage guide for AutoGen Studio in the context of the assessment platform.
    """
    print("""
📖 AutoGen Studio Usage Guide for Assessment Platform
═══════════════════════════════════════════════════

1. 🔧 Setup
   - Load model configuration from autogen_studio_config/models.json
   - Configure Azure OpenAI credentials in the UI
   
2. 👥 Agent Design
   - Import assessment team from autogen_studio_config/assessment_team.json
   - Customize agent system messages and tools
   - Test individual agent responses
   
3. 🔄 Workflow Testing
   - Create SelectorGroupChat workflows
   - Test assessment scenarios with sample data
   - Debug agent conversations and decision-making
   
4. 🎯 Use Cases
   - Prototype new agent capabilities
   - Test different assessment workflows
   - Validate agent system messages
   - Debug conversation flows
   
5. 📊 Integration
   - Export successful configurations
   - Use configurations in the main application
   - Iterate on agent improvements

🌐 Access AutoGen Studio at: http://localhost:8081
📁 Config files: ./autogen_studio_config/
""")

def main():
    """
    Main function to set up and optionally start AutoGen Studio.
    """
    print("🎯 AutoGen Studio Setup for Assessment Platform")
    print("=" * 50)
    
    # Create configuration files
    create_autogen_studio_config()
    
    # Print usage guide
    print_studio_usage_guide()
    
    # Ask if user wants to start AutoGen Studio
    if len(sys.argv) > 1 and sys.argv[1] == "--start":
        start_autogen_studio()
    else:
        print("\n💡 To start AutoGen Studio, run:")
        print("   python autogen_studio_config.py --start")
        print("\n   Or install and run manually:")
        print("   uv add --dev autogen-studio")
        print("   python -m autogen_studio --port 8081")

if __name__ == "__main__":
    main()
