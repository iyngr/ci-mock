import { DeveloperRole, ProgrammingLanguage } from './schema'

export interface RoleConfig {
    name: string
    description: string
    languages: ProgrammingLanguage[]
    defaultLanguage: ProgrammingLanguage
    showPreview: boolean
    executionEnvironment: 'judge0' | 'browser' | 'both'
    editorTheme: 'vs-dark' | 'vs-light'
    icon: string
}

export const ROLE_CONFIGS: Record<DeveloperRole, RoleConfig> = {
    [DeveloperRole.PYTHON_BACKEND]: {
        name: "Python Backend Developer",
        description: "Python, FastAPI, Django, Database Development",
        languages: [ProgrammingLanguage.PYTHON],
        defaultLanguage: ProgrammingLanguage.PYTHON,
        showPreview: false,
        executionEnvironment: 'judge0',
        editorTheme: 'vs-dark',
        icon: "🐍"
    },

    [DeveloperRole.JAVA_BACKEND]: {
        name: "Java Spring Boot Developer",
        description: "Java, Spring Boot, REST APIs, Microservices",
        languages: [ProgrammingLanguage.JAVA],
        defaultLanguage: ProgrammingLanguage.JAVA,
        showPreview: false,
        executionEnvironment: 'judge0',
        editorTheme: 'vs-dark',
        icon: "☕"
    },

    [DeveloperRole.NODE_BACKEND]: {
        name: "Node.js Backend Developer",
        description: "Node.js, Express, APIs, Server-side JavaScript",
        languages: [ProgrammingLanguage.JAVASCRIPT, ProgrammingLanguage.TYPESCRIPT],
        defaultLanguage: ProgrammingLanguage.JAVASCRIPT,
        showPreview: false,
        executionEnvironment: 'judge0',
        editorTheme: 'vs-dark',
        icon: "🟢"
    },

    [DeveloperRole.REACT_FRONTEND]: {
        name: "React Frontend Developer",
        description: "React, JavaScript, HTML/CSS, UI Components",
        languages: [ProgrammingLanguage.JAVASCRIPT, ProgrammingLanguage.TYPESCRIPT, ProgrammingLanguage.HTML, ProgrammingLanguage.CSS],
        defaultLanguage: ProgrammingLanguage.JAVASCRIPT,
        showPreview: true,
        executionEnvironment: 'browser',
        editorTheme: 'vs-dark',
        icon: "⚛️"
    },

    [DeveloperRole.FULLSTACK_JS]: {
        name: "Full Stack JavaScript Developer",
        description: "React, Node.js, JavaScript, Full Stack Development",
        languages: [ProgrammingLanguage.JAVASCRIPT, ProgrammingLanguage.TYPESCRIPT],
        defaultLanguage: ProgrammingLanguage.JAVASCRIPT,
        showPreview: true, // Can be overridden per question
        executionEnvironment: 'both',
        editorTheme: 'vs-dark',
        icon: "🚀"
    },

    [DeveloperRole.DEVOPS]: {
        name: "DevOps Engineer",
        description: "Docker, Kubernetes, YAML, Bash Scripts, Infrastructure",
        languages: [ProgrammingLanguage.BASH, ProgrammingLanguage.YAML, ProgrammingLanguage.PYTHON],
        defaultLanguage: ProgrammingLanguage.YAML,
        showPreview: false,
        executionEnvironment: 'judge0',
        editorTheme: 'vs-dark',
        icon: "🔧"
    }
}

export const getRoleConfig = (role: DeveloperRole | string): RoleConfig => {
    return ROLE_CONFIGS[role as DeveloperRole] || ROLE_CONFIGS[DeveloperRole.FULLSTACK_JS]
}

export const getAllRoles = (): Array<{ value: DeveloperRole, label: string, description: string, icon: string }> => {
    return Object.entries(ROLE_CONFIGS).map(([value, config]) => ({
        value: value as DeveloperRole,
        label: config.name,
        description: config.description,
        icon: config.icon
    }))
}

export const getLanguagesForRole = (role: DeveloperRole | string): ProgrammingLanguage[] => {
    const config = getRoleConfig(role as DeveloperRole)
    return config.languages
}
