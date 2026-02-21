import { VoiceIntent, Component, DEFAULT_PROPS, ComponentType } from "@/types/intent";
import { ProjectFileSystem, FileNode, isFile, isDirectory, DirectoryNode } from "@/types/filesystem";
import { ShadowFile, ShadowFileStatus } from "@/types/shadow";
import { applyColorToClassName } from "./intentNormalizer";
import {
  findNodeByPath,
  updateFileContent,
  insertFile,
  insertDirectory,
  deleteNode,
} from "./filesystemStore";
import {
  generatePageContent,
  updatePageFile,
  createNewComponentFileContent,
} from "./fileGenerators";
import { extractAllComponents } from "./componentParser";
import {
  shadowWorkspace,
  isPathEditable,
  validateFile,
} from "./shadowWorkspace";
import {
  WorkspaceOrchestrator,
  createOrchestrator,
  buildApplicationGraph,
  detectAppRoot,
} from "./workspaceOrchestrator";
import { ComponentTemplate, PageTemplate } from "@/types/orchestrator";

function generateComponentId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createComponentFromIntent(intent: VoiceIntent): Component {
  const componentType = intent.component?.type || "div";
  const defaultProps = DEFAULT_PROPS[componentType] || {};
  const props = { ...defaultProps, ...intent.component?.props };

  if (intent.component?.props?.className && intent.component?.props?.color) {
    props.className = applyColorToClassName(
      props.className || "",
      intent.component.props.color as string
    );
  }

  return {
    id: generateComponentId(),
    type: componentType,
    props,
    children: intent.component?.children || [],
  };
}

function componentToTemplate(component: Component): ComponentTemplate {
  return {
    name: component.props.text || component.type,
    type: component.type,
    props: component.props as Record<string, unknown>,
    hasChildren: component.children && component.children.length > 0,
  };
}

export interface VoiceOperationResult {
  success: boolean;
  message: string;
  affectedPath?: string;
  affectedFiles?: string[];
  componentId?: string;
  shadowStatus?: ShadowFileStatus;
  validationErrors?: string[];
  operations?: { type: string; path: string }[];
}

export function executeVoiceOperation(
  fs: ProjectFileSystem,
  intent: VoiceIntent
): VoiceOperationResult {
  if (!intent || intent.type === "none") {
    return { success: false, message: "No valid intent to execute" };
  }

  shadowWorkspace.initializeFromFilesystem(fs);

  const appRoot = detectAppRoot(fs.root as DirectoryNode);
  const mainPagePath = `${appRoot}/page.tsx`;

  const orchestrator = createOrchestrator(fs.root as DirectoryNode);

  switch (intent.type) {
    case "component.create": {
      if (!intent.component) {
        return { success: false, message: "No component specified in intent" };
      }

      const component = createComponentFromIntent(intent);
      const template = componentToTemplate(component);
      const targetPage = intent.component.props?.page as string;

      const pagePath = targetPage && targetPage !== "page"
        ? orchestrator.ensureRoute(targetPage)
        : mainPagePath;

      if (template.type === "div" || template.type === "text") {
        const pageFile = findNodeByPath(fs.root, pagePath);
        const existingContent = pageFile && isFile(pageFile) ? pageFile.content : "";
        
        const existingComponents = extractAllComponents(fs.root);
        const updatedComponents = [...existingComponents, component];
        const newContent = updatePageFile(existingContent, updatedComponents);
        
        const shadow = shadowWorkspace.writeShadowFile(pagePath, newContent);
        
        if (shadow.status === "failed") {
          return {
            success: false,
            message: `Validation failed: ${shadow.validationErrors.join(", ")}`,
            affectedPath: pagePath,
            shadowStatus: "failed",
            validationErrors: shadow.validationErrors,
          };
        }
        
        const success = updateFileContent(fs.root, pagePath, newContent);
        const commitResult = shadowWorkspace.commitShadowFile(pagePath);
        
        return {
          success: success && commitResult.success,
          message: success ? `Created ${component.type} component` : "Failed to create component",
          affectedPath: pagePath,
          affectedFiles: [pagePath],
          componentId: component.id,
          shadowStatus: shadow.status,
          validationErrors: shadow.validationErrors,
        };
      }

      const componentPath = orchestrator.createComponent(template);
      
      const componentFile = orchestrator.getFileContent(componentPath);
      if (!componentFile) {
        return { success: false, message: "Failed to create component file" };
      }

      const shadowComp = shadowWorkspace.writeShadowFile(componentPath, componentFile);
      if (shadowComp.status === "failed") {
        return {
          success: false,
          message: `Component validation failed: ${shadowComp.validationErrors.join(", ")}`,
          affectedPath: componentPath,
          shadowStatus: "failed",
          validationErrors: shadowComp.validationErrors,
        };
      }

      const registered = orchestrator.registerComponent(componentPath, pagePath);
      if (!registered) {
        return { success: false, message: "Failed to register component to page" };
      }

      const updatedPageContent = orchestrator.getFileContent(pagePath);
      if (!updatedPageContent) {
        return { success: false, message: "Failed to get updated page content" };
      }

      const shadowPage = shadowWorkspace.writeShadowFile(pagePath, updatedPageContent);
      if (shadowPage.status === "failed") {
        return {
          success: false,
          message: `Page validation failed: ${shadowPage.validationErrors.join(", ")}`,
          affectedPath: pagePath,
          shadowStatus: "failed",
          validationErrors: shadowPage.validationErrors,
        };
      }

      const finalComponentContent = orchestrator.getFileContent(componentPath);
      if (finalComponentContent) {
        insertFile(fs.root, componentPath, finalComponentContent);
      }
      
      const finalPageContent = orchestrator.getFileContent(pagePath);
      if (finalPageContent) {
        updateFileContent(fs.root, pagePath, finalPageContent);
      }

      shadowWorkspace.commitShadowFile(componentPath);
      shadowWorkspace.commitShadowFile(pagePath);

      return {
        success: true,
        message: `Created ${component.type} component "${component.props.text || ''}"`,
        affectedPath: pagePath,
        affectedFiles: [componentPath, pagePath],
        componentId: component.id,
        shadowStatus: "committed",
        operations: orchestrator.getOperations().map(op => ({ type: op.type, path: op.path })),
      };
    }

    case "component.update": {
      const targetText = intent.target || intent.value || "";
      const updates: Partial<Component> = {};
      
      if (intent.component?.props) {
        updates.props = intent.component.props;
      }
      if (intent.value) {
        updates.props = { ...updates.props, text: intent.value };
      }

      if (!targetText && !intent.component?.props) {
        return { success: false, message: "No target or updates specified" };
      }

      const existingComponents = extractAllComponents(fs.root);
      
      const targetComponent = existingComponents.find(c => 
        c.props.text?.toLowerCase().includes(targetText.toLowerCase()) ||
        c.type.toLowerCase().includes(targetText.toLowerCase())
      );

      if (!targetComponent) {
        return { success: false, message: `Component "${targetText}" not found` };
      }

      const updatedComponents = existingComponents.map(c => {
        if (c.id === targetComponent.id) {
          return {
            ...c,
            ...updates,
            props: {
              ...c.props,
              ...updates.props,
            },
          };
        }
        return c;
      });

      const pageFile = findNodeByPath(fs.root, mainPagePath);
      if (!pageFile || !isFile(pageFile)) {
        return { success: false, message: "Page file not found" };
      }

      const newPageContent = updatePageFile(pageFile.content, updatedComponents);
      
      const shadow = shadowWorkspace.writeShadowFile(mainPagePath, newPageContent);
      
      if (shadow.status === "failed") {
        return {
          success: false,
          message: `Validation failed: ${shadow.validationErrors.join(", ")}`,
          affectedPath: mainPagePath,
          shadowStatus: "failed",
          validationErrors: shadow.validationErrors,
        };
      }

      const success = updateFileContent(fs.root, mainPagePath, newPageContent);
      const commitResult = shadowWorkspace.commitShadowFile(mainPagePath);
      
      return {
        success: success && commitResult.success,
        message: `Updated component: ${targetText}`,
        affectedPath: mainPagePath,
        affectedFiles: [mainPagePath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "component.delete": {
      const componentId = intent.target;
      const existingComponents = extractAllComponents(fs.root);
      
      let filteredComponents: Component[];
      if (componentId) {
        filteredComponents = existingComponents.filter((c) => c.id !== componentId);
      } else {
        if (existingComponents.length === 0) {
          return { success: false, message: "No components to delete" };
        }
        filteredComponents = existingComponents.slice(0, -1);
      }

      if (filteredComponents.length === existingComponents.length) {
        return { success: false, message: "Component not found" };
      }

      const pageFile = findNodeByPath(fs.root, mainPagePath);
      if (!pageFile || !isFile(pageFile)) {
        return { success: false, message: "Page file not found" };
      }

      const newPageContent = updatePageFile(pageFile.content, filteredComponents);
      
      const shadow = shadowWorkspace.writeShadowFile(mainPagePath, newPageContent);
      const success = updateFileContent(fs.root, mainPagePath, newPageContent);
      const commitResult = shadowWorkspace.commitShadowFile(mainPagePath);
      
      return {
        success: success && commitResult.success,
        message: "Deleted component",
        affectedPath: mainPagePath,
        affectedFiles: [mainPagePath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "component.duplicate": {
      const existingComponents = extractAllComponents(fs.root);
      
      if (existingComponents.length === 0) {
        return { success: false, message: "No components to duplicate" };
      }
      
      const lastComponent = existingComponents[existingComponents.length - 1];
      const duplicate: Component = {
        ...lastComponent,
        id: generateComponentId(),
      };
      
      const updatedComponents = [...existingComponents, duplicate];

      const pageFile = findNodeByPath(fs.root, mainPagePath);
      if (!pageFile || !isFile(pageFile)) {
        return { success: false, message: "Page file not found" };
      }

      const newPageContent = updatePageFile(pageFile.content, updatedComponents);
      
      const shadow = shadowWorkspace.writeShadowFile(mainPagePath, newPageContent);
      const success = updateFileContent(fs.root, mainPagePath, newPageContent);
      const commitResult = shadowWorkspace.commitShadowFile(mainPagePath);
      
      return {
        success: success && commitResult.success,
        message: "Duplicated last component",
        affectedPath: mainPagePath,
        affectedFiles: [mainPagePath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "page.create": {
      const pageName = intent.pageName || intent.value || "new-page";
      const pagePath = orchestrator.ensureRoute(pageName);
      
      const pageContent = orchestrator.getFileContent(pagePath);
      if (!pageContent) {
        return { success: false, message: "Failed to create page" };
      }

      const shadow = shadowWorkspace.writeShadowFile(pagePath, pageContent);
      
      if (shadow.status === "failed") {
        return {
          success: false,
          message: `Validation failed: ${shadow.validationErrors.join(", ")}`,
          affectedPath: pagePath,
          shadowStatus: "failed",
          validationErrors: shadow.validationErrors,
        };
      }

      insertDirectory(fs.root, `app/${pageName}`);
      insertFile(fs.root, pagePath, pageContent);
      
      const commitResult = shadowWorkspace.commitShadowFile(pagePath);
      
      return {
        success: true,
        message: `Created new page: ${pageName}`,
        affectedPath: pagePath,
        affectedFiles: [pagePath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "page.delete": {
      const pageName = intent.pageName || intent.target || "";
      if (!pageName || pageName === "page") {
        return { success: false, message: "Cannot delete main page" };
      }
      
      const dirPath = `${appRoot}/${pageName}`;
      const pageFilePath = `${appRoot}/${pageName}/page.tsx`;
      const success = deleteNode(fs.root, dirPath);
      shadowWorkspace.discardShadowFile(pageFilePath);
      
      return {
        success,
        message: success ? `Deleted page: ${pageName}` : `Failed to delete page: ${pageName}`,
        affectedPath: pageFilePath,
        affectedFiles: [pageFilePath],
        shadowStatus: "discarded",
      };
    }

    case "nav.add": {
      const graph = orchestrator.scan();
      const pages = graph.pages.filter(p => p.route !== "/");
      
      const links = pages.map(p => ({
        label: p.route.replace(/^\//, "").charAt(0).toUpperCase() + p.route.replace(/^\//, "").slice(1) || "Home",
        href: p.route,
      }));
      
      links.unshift({ label: "Home", href: "/" });

      const pagePath = mainPagePath;
      orchestrator.addNavigationToPage(pagePath, links);
      
      const updatedContent = orchestrator.getFileContent(pagePath);
      if (!updatedContent) {
        return { success: false, message: "Failed to add navigation" };
      }

      const shadow = shadowWorkspace.writeShadowFile(pagePath, updatedContent);
      
      if (shadow.status === "failed") {
        return {
          success: false,
          message: `Validation failed: ${shadow.validationErrors.join(", ")}`,
          affectedPath: pagePath,
          shadowStatus: "failed",
          validationErrors: shadow.validationErrors,
        };
      }

      updateFileContent(fs.root, pagePath, updatedContent);
      shadowWorkspace.commitShadowFile(pagePath);
      
      return {
        success: true,
        message: "Added navigation component",
        affectedPath: pagePath,
        affectedFiles: [pagePath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "file.create": {
      const filePath = intent.component?.props?.path as string;
      const content = (intent.component?.props?.content as string) || "";
      
      if (!filePath) {
        return { success: false, message: "No file path specified" };
      }

      if (!isPathEditable(filePath)) {
        return { success: false, message: `Path "${filePath}" is not editable` };
      }

      const shadow = shadowWorkspace.writeShadowFile(filePath, content);
      const validation = validateFile(filePath, content);
      
      if (!validation.valid) {
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(", ")}`,
          affectedPath: filePath,
          shadowStatus: "failed",
          validationErrors: validation.errors,
        };
      }

      const dirPath = filePath.split("/").slice(0, -1).join("/");
      if (dirPath) {
        insertDirectory(fs.root, dirPath);
      }

      const success = insertFile(fs.root, filePath, content);
      const commitResult = shadowWorkspace.commitShadowFile(filePath);
      
      return {
        success: success && commitResult.success,
        message: success ? `Created file: ${filePath}` : `Failed to create file: ${filePath}`,
        affectedPath: filePath,
        affectedFiles: [filePath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "file.update": {
      const filePath = intent.component?.props?.path as string;
      const content = (intent.component?.props?.content as string) || "";
      
      if (!filePath) {
        return { success: false, message: "No file path specified" };
      }

      if (!isPathEditable(filePath)) {
        return { success: false, message: `Path "${filePath}" is not editable` };
      }

      const shadow = shadowWorkspace.writeShadowFile(filePath, content);
      
      if (shadow.status === "failed") {
        return {
          success: false,
          message: `Validation failed: ${shadow.validationErrors.join(", ")}`,
          affectedPath: filePath,
          shadowStatus: shadow.status,
          validationErrors: shadow.validationErrors,
        };
      }

      const success = updateFileContent(fs.root, filePath, content);
      const commitResult = shadowWorkspace.commitShadowFile(filePath);
      
      return {
        success: success && commitResult.success,
        message: success ? `Updated file: ${filePath}` : `Failed to update file: ${filePath}`,
        affectedPath: filePath,
        affectedFiles: [filePath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "file.delete": {
      const filePath = intent.component?.props?.path as string;
      
      if (!filePath) {
        return { success: false, message: "No file path specified" };
      }

      if (!isPathEditable(filePath)) {
        return { success: false, message: `Path "${filePath}" is not editable` };
      }

      const success = deleteNode(fs.root, filePath);
      shadowWorkspace.discardShadowFile(filePath);
      
      return {
        success,
        message: success ? `Deleted: ${filePath}` : `Failed to delete: ${filePath}`,
        affectedPath: filePath,
        affectedFiles: [filePath],
        shadowStatus: "discarded",
      };
    }

    case "directory.create": {
      const dirPath = intent.component?.props?.path as string;
      
      if (!dirPath) {
        return { success: false, message: "No directory path specified" };
      }

      const success = insertDirectory(fs.root, dirPath);
      return {
        success,
        message: success ? `Created directory: ${dirPath}` : `Failed to create directory: ${dirPath}`,
        affectedPath: dirPath,
        affectedFiles: [dirPath],
      };
    }

    case "ui.setTheme": {
      const isDark = intent.value === "dark";
      const globalsPath = `${appRoot}/globals.css`;
      
      const globalsFile = findNodeByPath(fs.root, globalsPath);
      if (!globalsFile || !isFile(globalsFile)) {
        return { success: false, message: "globals.css not found" };
      }

      let content = globalsFile.content;
      if (isDark) {
        content = content.replace(/--background:\s*#ffffff;/, "--background: #0a0a0a;");
        content = content.replace(/--foreground:\s*#171717;/, "--foreground: #ededed;");
      } else {
        content = content.replace(/--background:\s*#0a0a0a;/, "--background: #ffffff;");
        content = content.replace(/--foreground:\s*#ededed;/, "--foreground: #171717;");
      }

      const shadow = shadowWorkspace.writeShadowFile(globalsPath, content);
      const success = updateFileContent(fs.root, globalsPath, content);
      const commitResult = shadowWorkspace.commitShadowFile(globalsPath);
      
      return {
        success: success && commitResult.success,
        message: `Set theme to ${intent.value}`,
        affectedPath: globalsPath,
        affectedFiles: [globalsPath],
        shadowStatus: shadow.status,
        validationErrors: shadow.validationErrors,
      };
    }

    case "ui.setColor": {
      if (!intent.value) {
        return { success: false, message: "No color specified" };
      }
      return {
        success: true,
        message: `Set color to ${intent.value}`,
        shadowStatus: "committed",
      };
    }

    default:
      return { success: false, message: `Unknown intent type: ${intent.type}` };
  }
}
