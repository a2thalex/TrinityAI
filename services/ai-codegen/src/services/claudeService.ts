import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { ProjectSpecification, CodeGenerationRequest, GeneratedCode } from '../types';

class ClaudeService {
  private client: Anthropic;
  private claudeCodeAgent: any; // Claude Code SDK specific agent

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async initialize() {
    try {
      // Initialize Claude Code SDK specific features
      logger.info('Initializing Claude Code SDK...');

      // This would integrate with the actual Claude Code SDK
      // For now, we're using the standard Anthropic SDK with enhanced prompts

      logger.info('Claude Code SDK initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Claude Code SDK:', error);
      throw error;
    }
  }

  /**
   * Generate a complete web application based on specification
   */
  async generateWebApp(spec: ProjectSpecification): Promise<GeneratedCode> {
    try {
      const systemPrompt = this.buildSystemPrompt(spec);
      const userPrompt = this.buildUserPrompt(spec);

      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 8192,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      return this.parseCodeResponse(response.content[0].text, spec);
    } catch (error) {
      logger.error('Error generating web app:', error);
      throw error;
    }
  }

  /**
   * Generate specific component or feature
   */
  async generateComponent(request: CodeGenerationRequest): Promise<GeneratedCode> {
    try {
      const prompt = this.buildComponentPrompt(request);

      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return this.parseComponentResponse(response.content[0].text, request);
    } catch (error) {
      logger.error('Error generating component:', error);
      throw error;
    }
  }

  /**
   * Review and optimize generated code
   */
  async reviewCode(code: string, context: any): Promise<{
    suggestions: string[];
    optimizedCode: string;
    security: string[];
    performance: string[];
  }> {
    try {
      const reviewPrompt = `
        Review the following code for:
        1. Security vulnerabilities
        2. Performance optimizations
        3. Best practices
        4. Code quality

        Code:
        ${code}

        Context: ${JSON.stringify(context)}

        Provide:
        1. List of suggestions
        2. Optimized version of the code
        3. Security considerations
        4. Performance improvements
      `;

      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: reviewPrompt
          }
        ]
      });

      return this.parseReviewResponse(response.content[0].text);
    } catch (error) {
      logger.error('Error reviewing code:', error);
      throw error;
    }
  }

  /**
   * Generate documentation for code
   */
  async generateDocumentation(code: string, type: 'api' | 'user' | 'technical'): Promise<string> {
    try {
      const docPrompt = `
        Generate ${type} documentation for the following code:

        ${code}

        Include:
        - Overview
        - Key features
        - Usage examples
        - API references (if applicable)
        - Configuration options
      `;

      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 2048,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: docPrompt
          }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      logger.error('Error generating documentation:', error);
      throw error;
    }
  }

  /**
   * Generate tests for code
   */
  async generateTests(code: string, framework: string = 'jest'): Promise<string> {
    try {
      const testPrompt = `
        Generate comprehensive ${framework} tests for the following code:

        ${code}

        Include:
        - Unit tests
        - Integration tests
        - Edge cases
        - Error handling tests
        - Performance tests (if applicable)
      `;

      const response = await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 3072,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: testPrompt
          }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      logger.error('Error generating tests:', error);
      throw error;
    }
  }

  private buildSystemPrompt(spec: ProjectSpecification): string {
    return `
      You are an expert full-stack developer using the Claude Code SDK to generate production-ready web applications.
      You follow best practices, write clean code, and ensure security and performance.

      Project Type: ${spec.type}
      Framework: ${spec.framework}
      Language: ${spec.language}

      Requirements:
      - Generate complete, working code
      - Include proper error handling
      - Add comprehensive comments
      - Follow ${spec.framework} best practices
      - Ensure responsive design for web apps
      - Include necessary configuration files
      - Add proper TypeScript types if applicable

      You must generate code that is:
      1. Production-ready
      2. Secure
      3. Performant
      4. Maintainable
      5. Well-documented
    `;
  }

  private buildUserPrompt(spec: ProjectSpecification): string {
    return `
      Create a ${spec.type} application with the following specifications:

      Name: ${spec.name}
      Description: ${spec.description}

      Features:
      ${spec.features.map(f => `- ${f.name}: ${f.description}`).join('\n')}

      Technical Requirements:
      - Framework: ${spec.framework}
      - Language: ${spec.language}
      - Database: ${spec.database || 'Not specified'}
      - Authentication: ${spec.authentication || 'Not required'}

      Dependencies:
      ${spec.dependencies?.join(', ') || 'Standard dependencies'}

      Additional Requirements:
      ${spec.requirements?.join('\n') || 'None'}

      Generate the complete application structure including:
      1. Project setup and configuration
      2. Core application files
      3. All required components/modules
      4. Database schema (if applicable)
      5. API endpoints (if applicable)
      6. Frontend components (if applicable)
      7. Tests
      8. Documentation
      9. Deployment configuration
    `;
  }

  private buildComponentPrompt(request: CodeGenerationRequest): string {
    return `
      Generate a ${request.componentType} with the following specifications:

      Name: ${request.name}
      Purpose: ${request.description}

      Requirements:
      ${request.requirements?.join('\n') || 'Standard implementation'}

      Context:
      - Project Type: ${request.context?.projectType || 'Web Application'}
      - Framework: ${request.context?.framework || 'React'}
      - Existing Code: ${request.context?.existingCode ? 'Yes' : 'No'}

      Generate complete, production-ready code including:
      1. Component/Module implementation
      2. TypeScript types/interfaces
      3. Styles (if applicable)
      4. Tests
      5. Documentation
      6. Usage examples
    `;
  }

  private parseCodeResponse(response: string, spec: ProjectSpecification): GeneratedCode {
    // Parse the Claude response and structure it into files
    // This is a simplified version - actual implementation would be more sophisticated

    const files = new Map<string, string>();
    const sections = response.split('```');

    for (let i = 1; i < sections.length; i += 2) {
      const content = sections[i];
      const lines = content.split('\n');
      const firstLine = lines[0];

      // Extract filename from code block header
      const filename = this.extractFilename(firstLine, spec);
      if (filename) {
        files.set(filename, lines.slice(1).join('\n'));
      }
    }

    return {
      projectName: spec.name,
      files,
      structure: this.generateProjectStructure(files),
      dependencies: this.extractDependencies(response),
      scripts: this.extractScripts(response),
      documentation: this.extractDocumentation(response),
      deployment: this.extractDeploymentConfig(response)
    };
  }

  private parseComponentResponse(response: string, request: CodeGenerationRequest): GeneratedCode {
    const files = new Map<string, string>();
    const sections = response.split('```');

    for (let i = 1; i < sections.length; i += 2) {
      const content = sections[i];
      const lines = content.split('\n');
      const firstLine = lines[0];

      const filename = this.extractComponentFilename(firstLine, request);
      if (filename) {
        files.set(filename, lines.slice(1).join('\n'));
      }
    }

    return {
      projectName: request.name,
      files,
      structure: this.generateComponentStructure(files),
      dependencies: [],
      scripts: {},
      documentation: '',
      deployment: null
    };
  }

  private parseReviewResponse(response: string): any {
    // Parse review response into structured format
    // This is simplified - actual implementation would use more sophisticated parsing

    const sections = response.split('\n\n');

    return {
      suggestions: this.extractListFromSection(sections, 'Suggestions'),
      optimizedCode: this.extractCodeFromSection(sections, 'Optimized'),
      security: this.extractListFromSection(sections, 'Security'),
      performance: this.extractListFromSection(sections, 'Performance')
    };
  }

  private extractFilename(header: string, spec: ProjectSpecification): string | null {
    // Extract filename from code block header
    // Example: "typescript:src/App.tsx" -> "src/App.tsx"
    const match = header.match(/^(\w+):(.+)$/);
    if (match) {
      return match[2].trim();
    }

    // Try to infer filename from content
    if (header.includes('package.json')) return 'package.json';
    if (header.includes('tsconfig')) return 'tsconfig.json';
    if (header.includes('dockerfile')) return 'Dockerfile';

    return null;
  }

  private extractComponentFilename(header: string, request: CodeGenerationRequest): string | null {
    const match = header.match(/^(\w+):(.+)$/);
    if (match) {
      return match[2].trim();
    }

    // Generate filename based on component type and name
    const extension = request.context?.language === 'typescript' ? '.tsx' : '.jsx';
    return `${request.name}${extension}`;
  }

  private generateProjectStructure(files: Map<string, string>): any {
    const structure: any = {};

    for (const [path, content] of files) {
      const parts = path.split('/');
      let current = structure;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = 'file';
    }

    return structure;
  }

  private generateComponentStructure(files: Map<string, string>): any {
    return {
      components: {
        [files.keys().next().value || 'Component']: 'file'
      }
    };
  }

  private extractDependencies(response: string): string[] {
    // Extract dependencies from package.json or import statements
    const deps: Set<string> = new Set();

    // Look for package.json content
    const packageJsonMatch = response.match(/package\.json[^`]*```[^`]*"dependencies":\s*{([^}]+)}/);
    if (packageJsonMatch) {
      const depsContent = packageJsonMatch[1];
      const depMatches = depsContent.matchAll(/"([^"]+)":/g);
      for (const match of depMatches) {
        deps.add(match[1]);
      }
    }

    return Array.from(deps);
  }

  private extractScripts(response: string): Record<string, string> {
    const scripts: Record<string, string> = {};

    // Look for package.json scripts
    const scriptsMatch = response.match(/"scripts":\s*{([^}]+)}/);
    if (scriptsMatch) {
      const scriptsContent = scriptsMatch[1];
      const scriptMatches = scriptsContent.matchAll(/"([^"]+)":\s*"([^"]+)"/g);
      for (const match of scriptMatches) {
        scripts[match[1]] = match[2];
      }
    }

    return scripts;
  }

  private extractDocumentation(response: string): string {
    // Extract README or documentation sections
    const readmeMatch = response.match(/README\.md[^`]*```[^`]*([^`]+)/);
    if (readmeMatch) {
      return readmeMatch[1].trim();
    }

    return 'Documentation pending generation';
  }

  private extractDeploymentConfig(response: string): any {
    // Extract deployment configuration
    const dockerMatch = response.match(/Dockerfile[^`]*```[^`]*([^`]+)/);
    const k8sMatch = response.match(/deployment\.yaml[^`]*```[^`]*([^`]+)/);

    return {
      docker: dockerMatch ? dockerMatch[1].trim() : null,
      kubernetes: k8sMatch ? k8sMatch[1].trim() : null,
      platform: 'docker'
    };
  }

  private extractListFromSection(sections: string[], keyword: string): string[] {
    const section = sections.find(s => s.toLowerCase().includes(keyword.toLowerCase()));
    if (!section) return [];

    const lines = section.split('\n');
    return lines
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[\-\*]\s*/, '').trim());
  }

  private extractCodeFromSection(sections: string[], keyword: string): string {
    const section = sections.find(s => s.toLowerCase().includes(keyword.toLowerCase()));
    if (!section) return '';

    const codeMatch = section.match(/```[^`]*([^`]+)```/);
    return codeMatch ? codeMatch[1].trim() : '';
  }
}

let claudeService: ClaudeService;

export async function initializeClaudeSDK() {
  claudeService = new ClaudeService();
  await claudeService.initialize();
}

export function getClaudeService(): ClaudeService {
  if (!claudeService) {
    throw new Error('Claude service not initialized');
  }
  return claudeService;
}