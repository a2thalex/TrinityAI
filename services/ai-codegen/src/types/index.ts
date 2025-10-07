export interface ProjectSpecification {
  name: string;
  type: ProjectType;
  description: string;
  framework: Framework;
  language: Language;
  features: Feature[];
  database?: Database;
  authentication?: AuthType;
  dependencies?: string[];
  requirements?: string[];
  styling?: StylingOption;
  testing?: TestingFramework;
  deployment?: DeploymentTarget;
}

export interface Feature {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  components?: string[];
  apis?: string[];
}

export interface CodeGenerationRequest {
  name: string;
  componentType: ComponentType;
  description: string;
  requirements?: string[];
  context?: {
    projectType?: string;
    framework?: string;
    language?: string;
    existingCode?: boolean;
    dependencies?: string[];
  };
}

export interface GeneratedCode {
  projectName: string;
  files: Map<string, string>;
  structure: any;
  dependencies: string[];
  scripts: Record<string, string>;
  documentation: string;
  deployment: any;
}

export interface GeneratedProject {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  framework: Framework;
  language: Language;
  status: ProjectStatus;
  files: ProjectFile[];
  repository?: GitRepository;
  deployment?: DeploymentInfo;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface ProjectFile {
  path: string;
  content: string;
  type: FileType;
  size: number;
  checksum: string;
}

export interface GitRepository {
  url: string;
  branch: string;
  commit: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
}

export interface DeploymentInfo {
  platform: DeploymentTarget;
  url?: string;
  status: DeploymentStatus;
  environment: 'development' | 'staging' | 'production';
  config: Record<string, any>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  framework: Framework;
  language: Language;
  features: string[];
  structure: any;
  files: TemplateFile[];
  variables: TemplateVariable[];
  tags: string[];
  popularity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateFile {
  path: string;
  content: string;
  isTemplate: boolean;
  variables?: string[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  validation?: string;
}

export interface CodeReview {
  id: string;
  projectId: string;
  suggestions: ReviewSuggestion[];
  security: SecurityIssue[];
  performance: PerformanceIssue[];
  quality: QualityMetric;
  score: number;
  reviewedAt: Date;
}

export interface ReviewSuggestion {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  suggestion: string;
  autoFixable: boolean;
}

export interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  description: string;
  recommendation: string;
  cwe?: string;
}

export interface PerformanceIssue {
  type: string;
  impact: 'high' | 'medium' | 'low';
  file: string;
  description: string;
  recommendation: string;
  metrics?: Record<string, number>;
}

export interface QualityMetric {
  maintainability: number;
  reliability: number;
  security: number;
  performance: number;
  testCoverage?: number;
  documentation?: number;
}

export enum ProjectType {
  WEB_APP = 'web-app',
  MOBILE_APP = 'mobile-app',
  API = 'api',
  MICROSERVICE = 'microservice',
  LIBRARY = 'library',
  CLI = 'cli',
  DESKTOP_APP = 'desktop-app',
  CHROME_EXTENSION = 'chrome-extension',
  GAME = 'game',
  AI_MODEL = 'ai-model',
  BLOCKCHAIN = 'blockchain',
  IOT = 'iot'
}

export enum Framework {
  REACT = 'react',
  NEXT = 'nextjs',
  VUE = 'vue',
  ANGULAR = 'angular',
  SVELTE = 'svelte',
  EXPRESS = 'express',
  FASTAPI = 'fastapi',
  DJANGO = 'django',
  FLASK = 'flask',
  SPRING = 'spring',
  DOTNET = 'dotnet',
  RAILS = 'rails',
  LARAVEL = 'laravel',
  FLUTTER = 'flutter',
  REACT_NATIVE = 'react-native',
  ELECTRON = 'electron',
  TAURI = 'tauri'
}

export enum Language {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  GO = 'go',
  RUST = 'rust',
  KOTLIN = 'kotlin',
  SWIFT = 'swift',
  DART = 'dart',
  RUBY = 'ruby',
  PHP = 'php',
  CPP = 'cpp',
  SOLIDITY = 'solidity'
}

export enum ComponentType {
  PAGE = 'page',
  COMPONENT = 'component',
  SERVICE = 'service',
  API_ENDPOINT = 'api-endpoint',
  DATABASE_MODEL = 'database-model',
  MIDDLEWARE = 'middleware',
  UTIL = 'utility',
  HOOK = 'hook',
  CONTEXT = 'context',
  STORE = 'store',
  REDUCER = 'reducer',
  ACTION = 'action',
  TEST = 'test',
  CONFIG = 'configuration'
}

export enum Database {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  REDIS = 'redis',
  SQLITE = 'sqlite',
  DYNAMODB = 'dynamodb',
  FIRESTORE = 'firestore',
  SUPABASE = 'supabase',
  PRISMA = 'prisma',
  NEO4J = 'neo4j',
  ELASTICSEARCH = 'elasticsearch',
  CASSANDRA = 'cassandra'
}

export enum AuthType {
  JWT = 'jwt',
  OAUTH = 'oauth',
  SESSION = 'session',
  API_KEY = 'api-key',
  BASIC = 'basic',
  FIREBASE = 'firebase',
  AUTH0 = 'auth0',
  COGNITO = 'cognito',
  CUSTOM = 'custom'
}

export enum StylingOption {
  TAILWIND = 'tailwind',
  CSS_MODULES = 'css-modules',
  STYLED_COMPONENTS = 'styled-components',
  EMOTION = 'emotion',
  SASS = 'sass',
  LESS = 'less',
  MATERIAL_UI = 'material-ui',
  CHAKRA_UI = 'chakra-ui',
  ANT_DESIGN = 'ant-design',
  BOOTSTRAP = 'bootstrap',
  VANILLA_CSS = 'vanilla-css'
}

export enum TestingFramework {
  JEST = 'jest',
  MOCHA = 'mocha',
  VITEST = 'vitest',
  CYPRESS = 'cypress',
  PLAYWRIGHT = 'playwright',
  SELENIUM = 'selenium',
  PYTEST = 'pytest',
  UNITTEST = 'unittest',
  JUNIT = 'junit',
  XUNIT = 'xunit',
  RSPEC = 'rspec'
}

export enum DeploymentTarget {
  VERCEL = 'vercel',
  NETLIFY = 'netlify',
  AWS = 'aws',
  GOOGLE_CLOUD = 'google-cloud',
  AZURE = 'azure',
  HEROKU = 'heroku',
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes',
  DIGITALOCEAN = 'digitalocean',
  CLOUDFLARE = 'cloudflare',
  GITHUB_PAGES = 'github-pages',
  SELF_HOSTED = 'self-hosted'
}

export enum ProjectStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  GENERATED = 'generated',
  REVIEWING = 'reviewing',
  DEPLOYING = 'deploying',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  ARCHIVED = 'archived'
}

export enum DeploymentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled-back'
}

export enum FileType {
  SOURCE = 'source',
  CONFIG = 'config',
  ASSET = 'asset',
  DOCUMENTATION = 'documentation',
  TEST = 'test',
  BUILD = 'build',
  DEPLOYMENT = 'deployment'
}